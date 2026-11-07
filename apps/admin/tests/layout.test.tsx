import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { contact, createFakeApi, project, renderApp } from './helpers.tsx';

describe('cadre', () => {
  test('le logo dit Portfolio Matis', async () => {
    renderApp('/projets', createFakeApi());
    expect(await screen.findByText('Portfolio Matis')).toBeInTheDocument();
    expect(screen.queryByText(/Chambre du Dev/)).not.toBeInTheDocument();
  });

  test('la barre latérale donne les sections et leurs compteurs', async () => {
    const api = createFakeApi({ projects: [project(), project({ id: 'b', position: 1 })] });
    renderApp('/projets', api);
    const nav = await screen.findByRole('navigation', { name: 'Sections' });
    const link = await within(nav).findByRole('link', { name: /Projets.*2/ });
    expect(link).toHaveAttribute('href', '/projets');
    for (const name of [/Expériences/, /Formations/, /Compétences/, /Présentation/, /Contact/]) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
  });

  test('l’adresse racine mène aux projets', async () => {
    const { router } = renderApp('/', createFakeApi());
    await screen.findByText('Portfolio Matis');
    await waitFor(() => expect(router.state.location.pathname).toBe('/projets'));
  });

  test('le fil d’Ariane suit la page', async () => {
    renderApp('/contact', createFakeApi({ contact: contact() }));
    expect(await screen.findByRole('heading', { level: 1, name: /Contact/ })).toBeInTheDocument();
  });

  test('une adresse inconnue l’indique, dans le cadre', async () => {
    renderApp('/inconnue', createFakeApi());
    expect(await screen.findByText(/page n’existe pas/i)).toBeInTheDocument();
    expect(screen.getByText('Portfolio Matis')).toBeInTheDocument();
  });
});
