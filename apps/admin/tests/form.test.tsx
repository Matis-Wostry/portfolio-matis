import { screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { createFakeApi, GOOD_PASSWORD, project, renderApp } from './helpers.tsx';

const editPokedex = async (api = createFakeApi({ projects: [project()] })) => {
  const view = renderApp('/projets/pokedex', api);
  const summary = await screen.findByLabelText('Résumé');
  await view.user.clear(summary);
  await view.user.type(summary, 'Un texte long à ne pas perdre');
  return { ...view, api, summary };
};

const save = (user: Awaited<ReturnType<typeof editPokedex>>['user']) =>
  user.click(screen.getByRole('button', { name: 'Enregistrer' }));

describe('session expirée à l’enregistrement', () => {
  test('le texte reste, et la reconnexion enregistre sans ressaisie', async () => {
    const { user, api, summary } = await editPokedex();
    api.expireSession();
    await save(user);

    expect(await screen.findByRole('dialog', { name: 'Session expirée' })).toBeInTheDocument();
    expect(summary).toHaveValue('Un texte long à ne pas perdre');
    expect(summary).toBeInTheDocument();

    await user.type(screen.getByLabelText('Mot de passe de reconnexion'), GOOD_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Se reconnecter' }));

    await waitFor(() => expect(api.state.projects[0]?.summary).toBe('Un texte long à ne pas perdre'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Résumé')).toHaveValue('Un texte long à ne pas perdre');
  });

  test('un mauvais mot de passe laisse la fenêtre ouverte et le texte intact', async () => {
    const { user, api, summary } = await editPokedex();
    api.expireSession();
    await save(user);
    await user.type(await screen.findByLabelText('Mot de passe de reconnexion'), 'mauvais');
    await user.click(screen.getByRole('button', { name: 'Se reconnecter' }));
    expect(await screen.findByText('Mot de passe incorrect')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(summary).toHaveValue('Un texte long à ne pas perdre');
  });

  test('annuler la reconnexion dit que rien n’est enregistré et garde le texte', async () => {
    const { user, api, summary } = await editPokedex();
    api.expireSession();
    await save(user);
    await user.click(await screen.findByRole('button', { name: 'Annuler' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/pas été enregistré/i);
    expect(summary).toHaveValue('Un texte long à ne pas perdre');
  });
});

describe('quitter une page modifiée', () => {
  const leave = async (user: Awaited<ReturnType<typeof editPokedex>>['user']) =>
    user.click(screen.getByRole('link', { name: /Contact/ }));

  test('demande confirmation, et rester garde le texte', async () => {
    const { user, summary, router } = await editPokedex();
    await leave(user);
    expect(await screen.findByRole('dialog', { name: /non enregistrées/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rester' }));
    expect(router.state.location.pathname).toBe('/projets/pokedex');
    expect(summary).toHaveValue('Un texte long à ne pas perdre');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('accepter de quitter change de page', async () => {
    const { user, router } = await editPokedex();
    await leave(user);
    await user.click(await screen.findByRole('button', { name: 'Quitter sans enregistrer' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/contact'));
  });

  test('après un enregistrement réussi, quitter ne demande rien', async () => {
    const { user, router } = await editPokedex();
    await save(user);
    expect(await screen.findByText('Enregistré')).toBeInTheDocument();
    await leave(user);
    await waitFor(() => expect(router.state.location.pathname).toBe('/contact'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('sans modification, quitter ne demande rien', async () => {
    const { user, router } = renderApp('/projets/pokedex', createFakeApi({ projects: [project()] }));
    await screen.findByLabelText('Résumé');
    await user.click(screen.getByRole('link', { name: /Contact/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/contact'));
  });

  test('fermer l’onglet avec des modifications est intercepté, sans modification non', async () => {
    const event = () => {
      const beforeUnload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(beforeUnload);
      return beforeUnload.defaultPrevented;
    };
    const { user } = await editPokedex();
    expect(event()).toBe(true);
    await save(user);
    await screen.findByText('Enregistré');
    expect(event()).toBe(false);
  });
});

describe('erreurs à l’enregistrement', () => {
  test('une erreur réseau s’affiche et le texte reste', async () => {
    const { user, api, summary } = await editPokedex();
    api.respondOnce('PUT /admin/projects/pokedex', 'network-error');
    await save(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(/joindre le serveur/i);
    expect(summary).toHaveValue('Un texte long à ne pas perdre');
  });

  test('une erreur de validation locale s’affiche sur le bon champ, en français, sans requête', async () => {
    const { user, api, summary } = await editPokedex();
    await user.clear(summary);
    await save(user);
    expect(await screen.findByText('Ce champ est obligatoire')).toBeInTheDocument();
    expect(summary).toHaveAttribute('aria-invalid', 'true');
    expect(api.callsTo('PUT /admin/projects/pokedex')).toHaveLength(0);
  });

  test('un refus de l’API avec chemin s’affiche sur le bon champ', async () => {
    const { user, api } = await editPokedex();
    api.respondOnce('PUT /admin/projects/pokedex', {
      status: 400,
      body: { message: 'Certains champs sont invalides', issues: [{ path: 'title', message: 'Titre refusé par le serveur' }] },
    });
    await save(user);
    expect(await screen.findByText('Titre refusé par le serveur')).toBeInTheDocument();
    expect(screen.getByLabelText('Titre')).toHaveAttribute('aria-invalid', 'true');
  });
});
