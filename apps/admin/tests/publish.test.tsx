import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { contact, createFakeApi, GOOD_PASSWORD, profile, project, renderApp } from './helpers.tsx';

const site = (over: object = {}) => ({ site: 'classique', state: 'success', url: 'https://github.com/run/1', error: null, ...over });
const published = (deploys: object[] = []) => ({ hasUnpublishedChanges: false, lastPublishedAt: '2026-11-07T08:00:00.000Z', deploys: deploys as Record<string, unknown>[] });

const publishButton = () => screen.findByRole('button', { name: 'Publier' });
const confirmPublish = async (user: ReturnType<typeof renderApp>['user']) => {
  await user.click(await publishButton());
  const dialog = await screen.findByRole('dialog', { name: /Publier/ });
  await user.click(within(dialog).getByRole('button', { name: 'Publier maintenant' }));
};

afterEach(() => {
  vi.useRealTimers();
});

describe('badge Brouillon', () => {
  test('s’affiche quand des modifications ne sont pas publiées', async () => {
    renderApp('/projets', createFakeApi());
    expect(await screen.findByText('Brouillon')).toBeInTheDocument();
  });

  test('disparaît quand tout est publié', async () => {
    renderApp('/projets', createFakeApi({ status: published() }));
    expect(await screen.findByText('Publié')).toBeInTheDocument();
    expect(screen.queryByText('Brouillon')).not.toBeInTheDocument();
  });

  test('revient après un enregistrement, sans recharger la page', async () => {
    const api = createFakeApi({ projects: [project()], status: published() });
    const { user } = renderApp('/projets/pokedex', api);
    await screen.findByText('Publié');
    api.state.status = { ...api.state.status, hasUnpublishedChanges: true };
    await user.type(await screen.findByLabelText('Résumé'), ' encore');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Brouillon')).toBeInTheDocument();
  });
});

describe('Publier', () => {
  test('demande confirmation, et annuler n’envoie rien', async () => {
    const api = createFakeApi();
    const { user } = renderApp('/projets', api);
    await user.click(await publishButton());
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler' }));
    expect(api.callsTo('POST /admin/publish')).toHaveLength(0);
  });

  test('publie, puis le badge passe à Publié', async () => {
    const api = createFakeApi();
    const { user } = renderApp('/projets', api);
    await confirmPublish(user);
    expect(await screen.findByText('Publié')).toBeInTheDocument();
    expect(api.callsTo('POST /admin/publish')).toHaveLength(1);
  });

  test('un double clic n’envoie qu’une seule requête', async () => {
    const api = createFakeApi();
    let finish: (value: { status: number; body: object }) => void = () => undefined;
    api.respondOnce('POST /admin/publish', () => new Promise((resolve) => { finish = resolve; }));
    const { user } = renderApp('/projets', api);
    await user.click(await publishButton());
    const dialog = await screen.findByRole('dialog', { name: /Publier/ });
    await user.dblClick(within(dialog).getByRole('button', { name: 'Publier maintenant' }));
    expect(await screen.findByRole('button', { name: /Publication/ })).toBeDisabled();
    expect(api.callsTo('POST /admin/publish')).toHaveLength(1);
    await act(async () => finish({ status: 200, body: { snapshotId: 1, deploys: [] } }));
  });

  test('un 409 liste ce qui manque, avec un lien vers l’écran concerné', async () => {
    const api = createFakeApi({ projects: [project()] });
    api.respondOnce('POST /admin/publish', {
      status: 409,
      body: {
        message: 'Le contenu n’est pas prêt à être publié',
        issues: [
          { path: 'profile', message: 'La présentation n’est pas remplie' },
          { path: 'projects.pokedex.categoryId', message: 'La catégorie « x » n’existe pas' },
          { path: 'media.a.png', message: 'Le fichier « a.png » est introuvable' },
        ],
      },
    });
    const { user, router } = renderApp('/contact', api);
    await confirmPublish(user);
    const dialog = await screen.findByRole('dialog', { name: /pas prêt/ });
    expect(within(dialog).getByRole('link', { name: 'La présentation n’est pas remplie' })).toHaveAttribute('href', '/presentation');
    expect(within(dialog).getByRole('link', { name: /catégorie/ })).toHaveAttribute('href', '/projets/pokedex');
    expect(within(dialog).getByRole('link', { name: /a\.png/ })).toHaveAttribute('href', '/medias');

    await user.click(within(dialog).getByRole('link', { name: 'La présentation n’est pas remplie' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/presentation'));
    expect(screen.queryByRole('dialog', { name: /pas prêt/ })).not.toBeInTheDocument();
  });

  test('une erreur serveur s’affiche, et Publier reste possible', async () => {
    const api = createFakeApi();
    api.respondOnce('POST /admin/publish', { status: 500, body: { message: 'Erreur interne du serveur' } });
    const { user } = renderApp('/projets', api);
    await confirmPublish(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur interne du serveur');
    expect(await publishButton()).toBeEnabled();
  });

  test('une session expirée demande la reconnexion, puis publie', async () => {
    const api = createFakeApi();
    const { user } = renderApp('/projets', api);
    await publishButton();
    api.expireSession();
    await confirmPublish(user);
    await user.type(await screen.findByLabelText('Mot de passe de reconnexion'), GOOD_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Se reconnecter' }));
    await waitFor(() => expect(api.state.status.hasUnpublishedChanges).toBe(false));
  });

  test('des modifications non enregistrées empêchent de publier, avec une explication', async () => {
    const api = createFakeApi({ projects: [project()] });
    const { user } = renderApp('/projets/pokedex', api);
    expect(await publishButton()).toBeEnabled();
    await user.type(await screen.findByLabelText('Résumé'), ' encore');
    expect(await publishButton()).toBeDisabled();
    expect(screen.getByText(/Enregistrez d’abord/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(async () => expect(await publishButton()).toBeEnabled());
    expect(screen.queryByText(/Enregistrez d’abord/)).not.toBeInTheDocument();
  });
});

describe('état des sites', () => {
  test('« Sites à jour » seulement si tous les déploiements sont en succès', async () => {
    renderApp('/projets', createFakeApi({ status: published([site(), site({ site: 'jeu' })]) }));
    expect(await screen.findByText('Sites à jour')).toBeInTheDocument();
  });

  test('sans site à déployer, ne prétend pas que les sites sont à jour', async () => {
    renderApp('/projets', createFakeApi({ status: published() }));
    expect(await screen.findByText(/Aucun site à déployer/)).toBeInTheDocument();
    expect(screen.queryByText('Sites à jour')).not.toBeInTheDocument();
  });

  test('avant toute publication, le dit', async () => {
    renderApp('/projets', createFakeApi());
    expect(await screen.findByText('Jamais publié')).toBeInTheDocument();
  });

  test('un échec s’affiche avec le site, la raison et un lien vers le run ; Publier reste possible', async () => {
    const status = published([site({ state: 'failure' }), site({ site: 'jeu' })]);
    renderApp('/projets', createFakeApi({ status }));
    expect(await screen.findByText(/classique : échec/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir le déploiement de classique' })).toHaveAttribute('href', 'https://github.com/run/1');
    expect(screen.queryByText('Sites à jour')).not.toBeInTheDocument();
    expect(await publishButton()).toBeEnabled();
  });

  test('un déclenchement refusé affiche sa raison', async () => {
    renderApp('/projets', createFakeApi({ status: published([site({ state: 'failure', url: null, error: 'GitHub a répondu 403' })]) }));
    expect(await screen.findByText(/GitHub a répondu 403/)).toBeInTheDocument();
  });

  test('un état inconnu ne se présente ni comme un succès ni comme un échec', async () => {
    renderApp('/projets', createFakeApi({ status: published([site({ state: 'unknown', url: null })]) }));
    expect(await screen.findByText(/État des sites inconnu/)).toBeInTheDocument();
  });

  test('interroge tant qu’un déploiement est en cours, puis s’arrête', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = createFakeApi({ status: published([site({ state: 'in_progress' })]) });
    renderApp('/projets', api);
    expect(await screen.findByText('Déploiement en cours')).toBeInTheDocument();
    const before = api.callsTo('GET /admin/status').length;

    api.state.status = published([site()]);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(await screen.findByText('Sites à jour')).toBeInTheDocument();
    const after = api.callsTo('GET /admin/status').length;
    expect(after).toBeGreaterThan(before);

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(api.callsTo('GET /admin/status')).toHaveLength(after);
  });
});

describe('Aperçu', () => {
  const full = () =>
    createFakeApi({
      profile: profile(),
      contact: contact(),
      projects: [
        project({ context: 'Un contexte rédigé', captures: [{ file: 'a.png', alt: 'Accueil du Pokédex' }] }),
        project({ id: 'secret', title: 'Projet secret', hidden: true, position: 1 }),
      ],
      experiences: [{ id: 'freelance', title: 'Développeur', company: 'Freelance', kind: 'alternance', start: '2025', end: null, summary: null, missions: ['Refondre un site'], techs: [], position: 0 }],
    });

  test('le bouton Aperçu y mène', async () => {
    const { user, router } = renderApp('/projets', full());
    await user.click(await screen.findByRole('link', { name: 'Aperçu' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/apercu'));
  });

  test('montre la fiche rédigée', async () => {
    renderApp('/apercu', full());
    expect(await screen.findByText('Un texte de présentation')).toBeInTheDocument();
    expect(screen.getByText('Un contexte rédigé')).toBeInTheDocument();
    expect(screen.getByText('Refondre un site')).toBeInTheDocument();
    expect(screen.getByText('matis@example.com')).toBeInTheDocument();
    expect(screen.getByAltText('Accueil du Pokédex')).toBeInTheDocument();
  });

  test('un projet masqué apparaît, signalé comme tel', async () => {
    renderApp('/apercu', full());
    const heading = await screen.findByRole('heading', { name: /Projet secret/ });
    expect(within(heading.closest('article') as HTMLElement).getByText('Masqué')).toBeInTheDocument();
  });

  test('n’affiche pas de champ vide', async () => {
    renderApp('/apercu', createFakeApi({ profile: profile({ about: null, goals: [] }), projects: [project({ techs: [], links: [] })] }));
    await screen.findByRole('heading', { name: /Pokédex/ });
    for (const label of ['Le contexte', 'Ce que j’ai fait', 'Le résultat', 'Objectifs', 'Technos', 'Liens']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  test('du HTML dans un texte reste du texte', async () => {
    renderApp('/apercu', createFakeApi({ projects: [project({ summary: '<script>alert(1)</script>' })] }));
    expect(await screen.findByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('.preview script')).toBeNull();
  });

  test('prévient que ce n’est pas l’apparence des sites', async () => {
    renderApp('/apercu', full());
    expect(await screen.findByText(/ne reproduit pas l’apparence des sites/)).toBeInTheDocument();
  });
});
