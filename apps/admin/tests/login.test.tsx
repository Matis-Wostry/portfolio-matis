import { screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { createFakeApi, GOOD_PASSWORD, renderApp } from './helpers.tsx';

describe('connexion', () => {
  test('sans session, la page de connexion s’affiche et aucune donnée n’est demandée', async () => {
    const api = createFakeApi({ authenticated: false });
    renderApp('/projets', api);
    expect(await screen.findByLabelText('Mot de passe')).toBeInTheDocument();
    expect(api.callsTo('GET /admin/draft')).toHaveLength(0);
    expect(screen.queryByText('Publier')).not.toBeInTheDocument();
  });

  test('un mauvais mot de passe affiche la réponse de l’API et conserve le champ', async () => {
    const api = createFakeApi({ authenticated: false });
    const { user } = renderApp('/projets', api);
    const field = await screen.findByLabelText('Mot de passe');
    await user.type(field, 'mauvais');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Mot de passe incorrect');
    expect(field).toHaveValue('mauvais');
  });

  test('trop de tentatives : le message de l’API s’affiche', async () => {
    const api = createFakeApi({ authenticated: false });
    api.respondOnce('POST /auth/login', { status: 429, body: { message: 'Trop de tentatives : réessayez dans quelques minutes' } });
    const { user } = renderApp('/projets', api);
    await user.type(await screen.findByLabelText('Mot de passe'), 'x');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de tentatives');
  });

  test('un serveur injoignable le dit, sans parler de mot de passe', async () => {
    const api = createFakeApi({ authenticated: false });
    api.respondOnce('POST /auth/login', 'network-error');
    const { user } = renderApp('/projets', api);
    await user.type(await screen.findByLabelText('Mot de passe'), 'x');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/joindre le serveur/i);
  });

  test('le bon mot de passe ouvre l’interface à la page demandée', async () => {
    const api = createFakeApi({ authenticated: false });
    const { user, router } = renderApp('/contact', api);
    await user.type(await screen.findByLabelText('Mot de passe'), GOOD_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('button', { name: 'Publier' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/contact');
  });

  test('se déconnecter ramène à la page de connexion', async () => {
    const api = createFakeApi();
    const { user } = renderApp('/projets', api);
    await user.click(await screen.findByRole('button', { name: 'Se déconnecter' }));
    expect(await screen.findByLabelText('Mot de passe')).toBeInTheDocument();
    await waitFor(() => expect(api.callsTo('POST /auth/logout')).toHaveLength(1));
  });
});
