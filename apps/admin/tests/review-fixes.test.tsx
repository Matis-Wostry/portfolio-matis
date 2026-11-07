import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createFakeApi, project, renderApp } from './helpers.tsx';

afterEach(() => {
  vi.useRealTimers();
});

describe('se déconnecter avec une saisie en cours', () => {
  const dirty = async () => {
    const view = renderApp('/projets/pokedex', createFakeApi({ projects: [project()] }));
    await view.user.type(await screen.findByLabelText('Résumé'), ' à ne pas perdre');
    await view.user.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    return view;
  };

  test('demande confirmation, et rester garde le texte et la session', async () => {
    const { user } = await dirty();
    const dialog = await screen.findByRole('dialog', { name: /non enregistrées/ });
    await user.click(within(dialog).getByRole('button', { name: 'Rester' }));
    expect(screen.getByLabelText('Résumé')).toHaveValue('Une API REST documentée à ne pas perdre');
    expect(screen.queryByLabelText('Mot de passe')).not.toBeInTheDocument();
  });

  test('confirmer déconnecte', async () => {
    const { user } = await dirty();
    const dialog = await screen.findByRole('dialog', { name: /non enregistrées/ });
    await user.click(within(dialog).getByRole('button', { name: 'Se déconnecter quand même' }));
    expect(await screen.findByLabelText('Mot de passe')).toBeInTheDocument();
  });
});

describe('saisie pendant l’enregistrement d’une création', () => {
  test('les champs sont figés pendant l’envoi, puis on arrive sur la fiche créée', async () => {
    const api = createFakeApi();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { user, router } = renderApp('/projets/nouveau?categorie=perso', api);
    await user.type(await screen.findByLabelText('Titre'), 'Pokédex');
    await user.type(screen.getByLabelText('Résumé'), 'Une API');
    api.respondOnce('POST /admin/projects', async () => {
      await gate;
      const body = api.calls.at(-1)?.body as Record<string, unknown>;
      api.state.projects.push({ ...(body as { id: string }), position: 0 });
      return { status: 201, body: { ...body, position: 0 } };
    });
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByLabelText('Résumé')).toBeDisabled();
    await act(async () => release());
    await waitFor(() => expect(router.state.location.pathname).toBe('/projets/pokedex'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('état inconnu des sites', () => {
  test('est réinterrogé, plus lentement, jusqu’à connaître le résultat', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const site = { site: 'classique', url: null, error: null };
    const api = createFakeApi({ status: { hasUnpublishedChanges: false, lastPublishedAt: '2026-11-07T08:00:00.000Z', deploys: [{ ...site, state: 'unknown' }] } });
    renderApp('/projets', api);
    expect(await screen.findByText(/État des sites inconnu/)).toBeInTheDocument();
    api.state.status = { ...api.state.status, deploys: [{ ...site, state: 'success' }] };
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(await screen.findByText('Sites à jour')).toBeInTheDocument();
  });
});

describe('liens des problèmes de publication', () => {
  test('un chemin par position mène à la fiche du bon élément', async () => {
    const api = createFakeApi({ projects: [project({ id: 'a', title: 'Alpha' }), project({ id: 'b', title: 'Bêta', position: 1 })] });
    api.respondOnce('POST /admin/publish', {
      status: 409,
      body: { message: 'Le contenu n’est pas prêt à être publié', issues: [{ path: 'projects.1.summary', message: 'Ce champ est obligatoire' }] },
    });
    const { user } = renderApp('/projets', api);
    await screen.findByText('Alpha');
    await user.click(await screen.findByRole('button', { name: 'Publier' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publier maintenant' }));
    const dialog = await screen.findByRole('dialog', { name: /pas prêt/ });
    const link = within(dialog).getByRole('link', { name: /Ce champ est obligatoire/ });
    expect(link).toHaveAttribute('href', '/projets/b');
    expect(link).toHaveTextContent(/Bêta/);
  });

  test('une position inconnue mène à la liste, sans fiche inexistante', async () => {
    const api = createFakeApi();
    api.respondOnce('POST /admin/publish', {
      status: 409,
      body: { message: 'Le contenu n’est pas prêt à être publié', issues: [{ path: 'experiences.4.start', message: 'Période invalide' }] },
    });
    const { user } = renderApp('/projets', api);
    await user.click(await screen.findByRole('button', { name: 'Publier' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publier maintenant' }));
    const dialog = await screen.findByRole('dialog', { name: /pas prêt/ });
    expect(within(dialog).getByRole('link', { name: /Période invalide/ })).toHaveAttribute('href', '/experiences');
  });
});

describe('déclenchement refusé à la publication', () => {
  test('s’affiche près du bouton, visible aussi sur téléphone', async () => {
    const api = createFakeApi();
    api.respondOnce('POST /admin/publish', { status: 200, body: { snapshotId: 1, deploys: [{ site: 'classique', error: 'GitHub a répondu 403' }] } });
    const { user } = renderApp('/projets', api);
    await user.click(await screen.findByRole('button', { name: 'Publier' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publier maintenant' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('classique');
    expect(alert).toHaveTextContent('GitHub a répondu 403');
    expect(alert.closest('.side')).toBeNull();
  });
});

describe('session expirée pendant un déploiement', () => {
  test('l’interrogation de fond n’ouvre pas la reconnexion toutes les 15 secondes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = createFakeApi({ status: { hasUnpublishedChanges: false, lastPublishedAt: '2026-11-07T08:00:00.000Z', deploys: [{ site: 'classique', state: 'in_progress', url: null, error: null }] } });
    renderApp('/projets', api);
    expect(await screen.findByText('Déploiement en cours')).toBeInTheDocument();
    api.expireSession();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.queryByRole('dialog', { name: 'Session expirée' })).not.toBeInTheDocument();
  });
});
