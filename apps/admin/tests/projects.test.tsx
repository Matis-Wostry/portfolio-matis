import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { createFakeApi, project, renderApp } from './helpers.tsx';

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

  test('la catégorie présélectionnée est perso', async () => {
    renderApp('/projets/nouveau', createFakeApi());
    expect(await screen.findByLabelText('Catégorie')).toHaveValue('perso');
  });

  test('titre, identifiant et résumé suffisent, et on arrive sur la fiche créée sans confirmation', async () => {
    const api = createFakeApi();
    const { user, router } = renderApp('/projets/nouveau', api);
    await user.type(await screen.findByLabelText('Titre'), 'Pokédex');
    await user.type(screen.getByLabelText('Résumé'), 'Une API REST');
    await user.click(saveButton());

    await waitFor(() => expect(router.state.location.pathname).toBe('/projets/pokedex'));
    expect(api.state.projects[0]).toMatchObject({ id: 'pokedex', categoryId: 'perso', context: null, work: null, result: null, hidden: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('un identifiant déjà pris affiche le message de l’API, et la saisie reste', async () => {
    const api = createFakeApi({ projects: [project()] });
    const { user } = renderApp('/projets/nouveau', api);
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

describe('catégories de projets', () => {
  test('modifier une catégorie l’enregistre sans identifiant ni position', async () => {
    const api = createFakeApi();
    const { user } = renderApp('/projets', api);
    const panel = await screen.findByRole('region', { name: 'Catégories de projets' });
    const titles = await within(panel).findAllByLabelText('Titre');
    await user.clear(titles[0]!);
    await user.type(titles[0]!, 'Professionnels');
    await user.click(within(panel).getAllByRole('button', { name: 'Enregistrer' })[0]!);
    await waitFor(() => expect(api.callsTo('PUT /admin/project-categories/pro')[0]?.body).toEqual({ title: 'Professionnels', description: 'En entreprise' }));
  });
});
