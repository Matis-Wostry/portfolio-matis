import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { CATEGORIES, createFakeApi, project, renderApp } from './helpers.tsx';

const saveButton = () => screen.getByRole('button', { name: 'Enregistrer' });

describe('création d’un projet', () => {
  test('l’identifiant se déduit du titre : « Pokédex » propose pokedex', async () => {
    const { user } = renderApp('/projets/nouveau', createFakeApi());
    await user.type(await screen.findByLabelText('Titre'), 'Pokédex');
    expect(screen.getByLabelText('Identifiant')).toHaveValue('pokedex');
  });

  test('l’identifiant reste modifiable, et le titre ne l’écrase plus ensuite', async () => {
    const { user } = renderApp('/projets/nouveau', createFakeApi());
    const id = await screen.findByLabelText('Identifiant');
    await user.type(id, 'mon-id');
    await user.type(screen.getByLabelText('Titre'), 'Autre chose');
    expect(id).toHaveValue('mon-id');
  });

  test('la liste des catégories vient de l’API, nouvelles catégories comprises', async () => {
    const api = createFakeApi({ 'project-categories': [...CATEGORIES, { id: 'hackathon', title: 'Hackathons', description: 'En 48 heures', position: 3 }] });
    renderApp('/projets/nouveau', api);
    const select = await screen.findByLabelText('Catégorie');
    await waitFor(() => expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choisir une catégorie', 'Projets pro', 'Projets école', 'Projets perso', 'Hackathons']));
  });

  test('sans catégorie choisie, l’enregistrement la demande, sans requête', async () => {
    const api = createFakeApi();
    const { user } = renderApp('/projets/nouveau', api);
    expect(await screen.findByLabelText('Catégorie')).toHaveValue('');
    await user.type(screen.getByLabelText('Titre'), 'Pokédex');
    await user.type(screen.getByLabelText('Résumé'), 'Une API REST');
    await user.click(saveButton());
    expect(await screen.findByText('Choisissez une catégorie')).toBeInTheDocument();
    expect(api.callsTo('POST /admin/projects')).toHaveLength(0);
  });

  test('ouvert depuis une liste filtrée, le projet prend la catégorie du filtre', async () => {
    renderApp('/projets/nouveau?categorie=ecole', createFakeApi());
    await waitFor(async () => expect(await screen.findByLabelText('Catégorie')).toHaveValue('ecole'));
  });

  test('titre, identifiant, catégorie et résumé suffisent, et on arrive sur la fiche créée sans confirmation', async () => {
    const api = createFakeApi();
    const { user, router } = renderApp('/projets/nouveau', api);
    await user.type(await screen.findByLabelText('Titre'), 'Pokédex');
    await user.selectOptions(screen.getByLabelText('Catégorie'), await screen.findByRole('option', { name: 'Projets perso' }));
    await user.type(screen.getByLabelText('Résumé'), 'Une API REST');
    await user.click(saveButton());

    await waitFor(() => expect(router.state.location.pathname).toBe('/projets/pokedex'));
    expect(api.state.projects[0]).toMatchObject({ id: 'pokedex', categoryId: 'perso', context: null, work: null, result: null, hidden: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('un identifiant déjà pris affiche le message de l’API, et la saisie reste', async () => {
    const api = createFakeApi({ projects: [project()] });
    const { user } = renderApp('/projets/nouveau?categorie=ecole', api);
    await user.type(await screen.findByLabelText('Titre'), 'Pokédex');
    await user.type(screen.getByLabelText('Résumé'), 'Une API REST');
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('existe déjà');
    expect(screen.getByLabelText('Résumé')).toHaveValue('Une API REST');
  });
});

describe('modification d’un projet', () => {
  test('l’identifiant est en lecture seule', async () => {
    renderApp('/projets/pokedex', createFakeApi({ projects: [project()] }));
    expect(await screen.findByLabelText('Identifiant')).toHaveAttribute('readonly');
  });

  test('n’envoie ni identifiant ni position, et un texte vidé devient nul', async () => {
    const api = createFakeApi({ projects: [project({ context: 'Ancien contexte' })] });
    const { user } = renderApp('/projets/pokedex', api);
    await user.clear(await screen.findByLabelText('Le contexte'));
    await user.click(saveButton());
    await waitFor(() => expect(api.callsTo('PUT /admin/projects/pokedex')).toHaveLength(1));
    const { body } = api.callsTo('PUT /admin/projects/pokedex')[0]!;
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('position');
    expect(body).toMatchObject({ context: null });
  });

  test('les textes détaillés ont de grandes zones de saisie', async () => {
    renderApp('/projets/pokedex', createFakeApi({ projects: [project()] }));
    for (const label of ['Le contexte', 'Ce que j’ai fait', 'Le résultat']) {
      expect(await screen.findByLabelText(label)).toHaveAttribute('rows', '8');
    }
  });

  test('ajouter et retirer une techno et un lien', async () => {
    const api = createFakeApi({ projects: [project()] });
    const { user } = renderApp('/projets/pokedex', api);
    await user.type(await screen.findByLabelText('Technos'), 'Express{Enter}');
    await user.click(screen.getByRole('button', { name: 'Retirer React' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter un lien' }));
    await user.type(screen.getByLabelText('Libellé du lien 2'), 'Démo');
    await user.type(screen.getByLabelText('Adresse du lien 2'), 'https://demo.example');
    await user.click(saveButton());
    await waitFor(() => expect(api.state.projects[0]?.techs).toEqual(['Express']));
    expect(api.state.projects[0]?.links).toEqual([
      { label: 'Code', href: 'https://github.com/Matis-Wostry/Pokedex' },
      { label: 'Démo', href: 'https://demo.example' },
    ]);
  });

  test('Entrée dans le champ des technos n’enregistre pas le formulaire', async () => {
    const api = createFakeApi({ projects: [project()] });
    const { user } = renderApp('/projets/pokedex', api);
    await user.type(await screen.findByLabelText('Technos'), 'Express{Enter}');
    expect(api.callsTo('PUT /admin/projects/pokedex')).toHaveLength(0);
    expect(screen.getByText('Express')).toBeInTheDocument();
  });

  test('un lien javascript: est refusé sur son champ, sans requête', async () => {
    const api = createFakeApi({ projects: [project({ links: [] })] });
    const { user } = renderApp('/projets/pokedex', api);
    await user.click(await screen.findByRole('button', { name: 'Ajouter un lien' }));
    await user.type(screen.getByLabelText('Libellé du lien 1'), 'X');
    await user.type(screen.getByLabelText('Adresse du lien 1'), 'javascript:alert(1)');
    await user.click(saveButton());
    expect(await screen.findByText(/Lien refusé/)).toBeInTheDocument();
    expect(screen.getByLabelText('Adresse du lien 1')).toHaveAttribute('aria-invalid', 'true');
    expect(api.callsTo('PUT /admin/projects/pokedex')).toHaveLength(0);
  });

  test('un projet inexistant le dit', async () => {
    renderApp('/projets/inconnu', createFakeApi());
    expect(await screen.findByRole('alert')).toHaveTextContent('Élément introuvable');
  });
});

describe('liste des projets', () => {
  const two = () => createFakeApi({ projects: [project({ id: 'a', title: 'Alpha', position: 0 }), project({ id: 'b', title: 'Bêta', position: 1, hidden: true })] });

  test('liste dans l’ordre et signale un projet masqué', async () => {
    renderApp('/projets', two());
    const list = await screen.findByRole('list', { name: 'Projets' });
    const items = await within(list).findAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Alpha');
    expect(items[1]).toHaveTextContent('Bêta');
    expect(within(items[1]!).getByText('Masqué')).toBeInTheDocument();
    expect(within(items[0]!).queryByText('Masqué')).not.toBeInTheDocument();
  });

  test('Descendre appelle reorder avec le nouvel ordre, et le premier ne peut pas monter', async () => {
    const api = two();
    const { user } = renderApp('/projets', api);
    expect(await screen.findByRole('button', { name: 'Monter Alpha' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descendre Bêta' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Descendre Alpha' }));
    await waitFor(() => expect(api.callsTo('POST /admin/projects/reorder')[0]?.body).toEqual({ ids: ['b', 'a'] }));
    const items = within(await screen.findByRole('list', { name: 'Projets' }));
    await waitFor(() => expect(items.getAllByRole('listitem')[0]).toHaveTextContent('Bêta'));
  });

  test('Supprimer demande confirmation, et annuler ne supprime rien', async () => {
    const api = two();
    const { user } = renderApp('/projets', api);
    await user.click(await screen.findByRole('button', { name: 'Supprimer Alpha' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Alpha');
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(api.callsTo('DELETE /admin/projects/a')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Supprimer Alpha' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(api.state.projects.map((p) => p.id)).toEqual(['b']));
  });

  test('une liste vide invite à créer', async () => {
    renderApp('/projets', createFakeApi());
    expect(await screen.findByText(/Rien pour l’instant/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ajouter' })).toHaveAttribute('href', '/projets/nouveau');
  });

  test('une erreur de chargement s’affiche', async () => {
    const api = createFakeApi();
    api.respondOnce('GET /admin/projects', { status: 500, body: { message: 'Erreur interne du serveur' } });
    renderApp('/projets', api);
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur interne du serveur');
  });
});

describe('filtre par catégorie', () => {
  const mixed = () =>
    createFakeApi({
      projects: [
        project({ id: 'b', title: 'Bêta', categoryId: 'ecole', position: 0 }),
        project({ id: 'a', title: 'Alpha', categoryId: 'pro', position: 1 }),
        project({ id: 'c', title: 'Gamma', categoryId: 'ecole', position: 2 }),
      ],
    });
  const titles = async () => within(await screen.findByRole('list', { name: 'Projets' })).getAllByRole('listitem').map((item) => item.querySelector('a')?.textContent);
  const filters = () => screen.findByRole('group', { name: 'Filtrer par catégorie' });

  test('chaque catégorie donne son nombre de projets, et le filtre ne garde que les siens', async () => {
    const { user, router } = renderApp('/projets', mixed());
    const group = await filters();
    expect(within(group).getByRole('button', { name: 'Toutes (3)' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Projets perso (0)' })).toBeInTheDocument();
    await user.click(within(group).getByRole('button', { name: 'Projets école (2)' }));
    expect(within(group).getByRole('button', { name: 'Projets école (2)' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(async () => expect(await titles()).toEqual(['Bêta', 'Gamma']));
    expect(router.state.location.search).toBe('?categorie=ecole');

    await user.click(within(group).getByRole('button', { name: 'Toutes (3)' }));
    await waitFor(async () => expect(await titles()).toEqual(['Bêta', 'Alpha', 'Gamma']));
  });

  test('le filtre se lit dans l’adresse, pour le retrouver au retour d’une fiche', async () => {
    renderApp('/projets?categorie=pro', mixed());
    await waitFor(async () => expect(await titles()).toEqual(['Alpha']));
  });

  test('chaque projet affiche le titre de sa catégorie', async () => {
    renderApp('/projets', mixed());
    const list = await screen.findByRole('list', { name: 'Projets' });
    await waitFor(() => expect(within(list).getAllByRole('listitem')[1]).toHaveTextContent('Projets pro'));
  });

  test('une catégorie vide le dit', async () => {
    const { user } = renderApp('/projets', mixed());
    await user.click(within(await filters()).getByRole('button', { name: 'Projets perso (0)' }));
    expect(await screen.findByText('Aucun projet dans cette catégorie.')).toBeInTheDocument();
  });

  test('Ajouter depuis un filtre ouvre la création avec cette catégorie', async () => {
    const { user } = renderApp('/projets', mixed());
    await user.click(within(await filters()).getByRole('button', { name: 'Projets école (2)' }));
    expect(screen.getByRole('link', { name: 'Ajouter' })).toHaveAttribute('href', '/projets/nouveau?categorie=ecole');
  });

  test('dans une liste filtrée, Descendre passe après le projet suivant de la catégorie', async () => {
    const api = mixed();
    const { user } = renderApp('/projets?categorie=ecole', api);
    await user.click(await screen.findByRole('button', { name: 'Descendre Bêta' }));
    await waitFor(() => expect(api.callsTo('POST /admin/projects/reorder')[0]?.body).toEqual({ ids: ['a', 'c', 'b'] }));
    await waitFor(async () => expect(await titles()).toEqual(['Gamma', 'Bêta']));
    expect(screen.getByRole('button', { name: 'Monter Gamma' })).toBeDisabled();
  });

  test('un projet dont la catégorie n’existe plus apparaît sous « Sans catégorie »', async () => {
    const { user } = renderApp('/projets', createFakeApi({ projects: [project({ id: 'x', title: 'Perdu', categoryId: 'ancienne' }), project()] }));
    await user.click(within(await filters()).getByRole('button', { name: 'Sans catégorie (1)' }));
    await waitFor(async () => expect(await titles()).toEqual(['Perdu']));
  });
});

describe('fenêtre des catégories', () => {
  const open = async (user: ReturnType<typeof renderApp>['user']) => {
    await user.click(await screen.findByRole('button', { name: 'Gérer les catégories' }));
    return screen.findByRole('dialog', { name: 'Catégories de projets' });
  };
  const withProjects = () => createFakeApi({ projects: [project({ id: 'a', categoryId: 'ecole' }), project({ id: 'b', categoryId: 'ecole', position: 1 })] });

  test('le bouton ouvre une fenêtre avec les catégories existantes, dans l’ordre', async () => {
    const { user } = renderApp('/projets', createFakeApi());
    const list = await within(await open(user)).findByRole('list', { name: 'Catégories existantes' });
    expect(within(list).getAllByLabelText('Titre').map((input) => (input as HTMLInputElement).value)).toEqual(['Projets pro', 'Projets école', 'Projets perso']);
  });

  test('modifier une catégorie l’enregistre sans identifiant ni position', async () => {
    const api = createFakeApi();
    const { user } = renderApp('/projets', api);
    const dialog = await open(user);
    const titles = await within(dialog).findAllByLabelText('Titre');
    await user.clear(titles[0]!);
    await user.type(titles[0]!, 'Professionnels');
    await user.click(within(dialog).getAllByRole('button', { name: 'Enregistrer' })[0]!);
    await waitFor(() => expect(api.callsTo('PUT /admin/project-categories/pro')[0]?.body).toEqual({ title: 'Professionnels', description: 'En entreprise' }));
  });

  test('ajouter une catégorie : l’identifiant se déduit du titre, et elle rejoint le filtre', async () => {
    const api = createFakeApi();
    const { user } = renderApp('/projets', api);
    const dialog = await open(user);
    const form = within(dialog).getByRole('form', { name: 'Nouvelle catégorie' });
    await user.type(within(form).getByLabelText('Titre'), 'Hackathons');
    expect(within(form).getByLabelText('Identifiant')).toHaveValue('hackathons');
    await user.type(within(form).getByLabelText('Description'), 'En 48 heures');
    await user.click(within(form).getByRole('button', { name: 'Ajouter la catégorie' }));

    await waitFor(() => expect(api.callsTo('POST /admin/project-categories')[0]?.body).toEqual({ id: 'hackathons', title: 'Hackathons', description: 'En 48 heures' }));
    const list = within(dialog).getByRole('list', { name: 'Catégories existantes' });
    await waitFor(() => expect(within(list).getAllByLabelText('Titre').at(-1)).toHaveValue('Hackathons'));
    expect(within(within(dialog).getByRole('form', { name: 'Nouvelle catégorie' })).getByLabelText('Titre')).toHaveValue('');
    expect(within(screen.getByRole('group', { name: 'Filtrer par catégorie' })).getByRole('button', { name: 'Hackathons (0)' })).toBeInTheDocument();
  });

  test('une catégorie sans titre ni description n’est pas envoyée', async () => {
    const api = createFakeApi();
    const { user } = renderApp('/projets', api);
    const form = within(await open(user)).getByRole('form', { name: 'Nouvelle catégorie' });
    await user.click(within(form).getByRole('button', { name: 'Ajouter la catégorie' }));
    expect(await within(form).findAllByText('Ce champ est obligatoire')).toHaveLength(2);
    expect(api.callsTo('POST /admin/project-categories')).toHaveLength(0);
  });

  test('supprimer une catégorie vide demande confirmation, puis la retire', async () => {
    const api = createFakeApi();
    const { user } = renderApp('/projets', api);
    const dialog = await open(user);
    await user.click(await within(dialog).findByRole('button', { name: 'Supprimer Projets perso' }));
    const confirm = await screen.findByRole('dialog', { name: 'Supprimer cette catégorie ?' });
    await user.click(within(confirm).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(api.state['project-categories'].map((c) => c.id)).toEqual(['pro', 'ecole']));
    expect(screen.getByRole('dialog', { name: 'Catégories de projets' })).toBeInTheDocument();
  });

  test('une catégorie qui contient des projets ne peut pas être supprimée, et le dit', async () => {
    const { user } = renderApp('/projets', withProjects());
    const dialog = await open(user);
    expect(await within(dialog).findByRole('button', { name: 'Supprimer Projets école' })).toBeDisabled();
    expect(within(dialog).getByText(/2 projets : changez-les de catégorie pour la supprimer/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Supprimer Projets pro' })).toBeEnabled();
  });

  test('un refus de l’API à la suppression s’affiche dans la fenêtre', async () => {
    const api = createFakeApi();
    api.respondOnce('DELETE /admin/project-categories/perso', { status: 409, body: { message: '« Projets perso » contient encore 1 projet' } });
    const { user } = renderApp('/projets', api);
    const dialog = await open(user);
    await user.click(await within(dialog).findByRole('button', { name: 'Supprimer Projets perso' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Supprimer cette catégorie ?' })).getByRole('button', { name: 'Supprimer' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('contient encore 1 projet');
  });

  test('Descendre change l’ordre des catégories', async () => {
    const api = createFakeApi();
    const { user } = renderApp('/projets', api);
    const dialog = await open(user);
    expect(await within(dialog).findByRole('button', { name: 'Monter Projets pro' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Descendre Projets pro' }));
    await waitFor(() => expect(api.callsTo('POST /admin/project-categories/reorder')[0]?.body).toEqual({ ids: ['ecole', 'pro', 'perso'] }));
  });

  test('Fermer avec une saisie non enregistrée demande confirmation', async () => {
    const { user } = renderApp('/projets', createFakeApi());
    const dialog = await open(user);
    await user.type((await within(dialog).findAllByLabelText('Titre'))[0]!, ' modifié');
    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }));

    const confirm = await screen.findByRole('dialog', { name: 'Fermer sans enregistrer ?' });
    await user.click(within(confirm).getByRole('button', { name: 'Continuer la saisie' }));
    expect(within(dialog).getAllByLabelText('Titre')[0]).toHaveValue('Projets pro modifié');

    await user.keyboard('{Escape}');
    await user.click(within(await screen.findByRole('dialog', { name: 'Fermer sans enregistrer ?' })).getByRole('button', { name: 'Fermer sans enregistrer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('Échap ferme la fenêtre quand tout est enregistré, et le focus revient au bouton', async () => {
    const { user } = renderApp('/projets', createFakeApi());
    await open(user);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Gérer les catégories' })).toHaveFocus();
  });
});
