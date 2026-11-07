import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { createFakeApi, profile, project, renderApp } from './helpers.tsx';

describe('fenêtres au clavier', () => {
  const openDelete = async () => {
    const view = renderApp('/projets', createFakeApi({ projects: [project({ id: 'a', title: 'Alpha' })] }));
    const trigger = await screen.findByRole('button', { name: 'Supprimer Alpha' });
    await view.user.click(trigger);
    return { ...view, trigger, dialog: await screen.findByRole('dialog') };
  };

  test('Échap ferme la fenêtre et rend le focus au bouton qui l’a ouverte', async () => {
    const { user, trigger } = await openDelete();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test('Tab reste dans la fenêtre, dans les deux sens', async () => {
    const { user, dialog } = await openDelete();
    const [first, last] = within(dialog).getAllByRole('button');
    expect(first).toHaveFocus();
    await user.tab();
    expect(last).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  test('Échap sur la reconnexion revient à l’annuler, sans perdre le texte', async () => {
    const api = createFakeApi({ projects: [project()] });
    const { user } = renderApp('/projets/pokedex', api);
    await user.type(await screen.findByLabelText('Résumé'), ' encore');
    api.expireSession();
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await screen.findByRole('dialog', { name: 'Session expirée' });
    await user.keyboard('{Escape}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/pas été enregistré/);
    expect(screen.getByLabelText('Résumé')).toHaveValue('Une API REST documentée encore');
  });
});

describe('identifiant réservé', () => {
  test('« nouveau » est refusé à la création, car c’est l’adresse de création', async () => {
    const api = createFakeApi();
    const { user } = renderApp('/projets/nouveau', api);
    await user.type(await screen.findByLabelText('Titre'), 'Nouveau');
    await user.type(screen.getByLabelText('Résumé'), 'Un résumé');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText(/« nouveau » est réservé/)).toBeInTheDocument();
    expect(api.callsTo('POST /admin/projects')).toHaveLength(0);
  });
});

describe('loisir sans identifiant possible', () => {
  test('l’erreur s’affiche sur le champ du loisir', async () => {
    const api = createFakeApi({ profile: profile({ hobbies: [] }) });
    const { user } = renderApp('/presentation', api);
    await user.click(await screen.findByRole('button', { name: 'Ajouter un loisir' }));
    await user.type(screen.getByLabelText('Loisir 1'), '???');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText(/au moins une lettre ou un chiffre/)).toBeInTheDocument();
    expect(screen.getByLabelText('Loisir 1')).toHaveAttribute('aria-invalid', 'true');
    expect(api.callsTo('PUT /admin/profile')).toHaveLength(0);
  });
});

describe('aperçu sans catégories', () => {
  test('les projets restent visibles, regroupés à part', async () => {
    renderApp('/apercu', createFakeApi({ 'project-categories': [], projects: [project()] }));
    expect(await screen.findByRole('heading', { name: 'Sans catégorie' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Pokédex/ })).toBeInTheDocument();
  });
});

describe('accessibilité des champs', () => {
  test('l’indication d’un champ est lue avec lui', async () => {
    renderApp('/experiences/nouveau', createFakeApi());
    expect(await screen.findByLabelText('Début')).toHaveAccessibleDescription('AAAA ou AAAA-MM');
  });

  test('l’erreur d’un champ de mots-clés est liée à ce champ', async () => {
    const api = createFakeApi({ projects: [project()] });
    api.respondOnce('PUT /admin/projects/pokedex', {
      status: 400,
      body: { message: 'Certains champs sont invalides', issues: [{ path: 'techs', message: 'Technos refusées' }] },
    });
    const { user } = renderApp('/projets/pokedex', api);
    await screen.findByLabelText('Technos');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await screen.findByText('Technos refusées');
    const field = screen.getByLabelText('Technos');
    expect(field).toHaveAccessibleDescription('Technos refusées');
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  test('le bouton Menu désigne la barre qu’il ouvre', async () => {
    renderApp('/projets', createFakeApi());
    const menu = await screen.findByRole('button', { name: 'Menu' });
    const controlled = document.getElementById(menu.getAttribute('aria-controls') ?? '');
    expect(controlled).not.toBeNull();
    expect(within(controlled as HTMLElement).getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
  });
});

describe('serveur injoignable', () => {
  test('le message indique les deux causes possibles', async () => {
    const api = createFakeApi({ authenticated: false });
    api.respondOnce('POST /auth/login', 'network-error');
    const { user } = renderApp('/projets', api);
    await user.type(await screen.findByLabelText('Mot de passe'), 'x');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/ADMIN_ORIGIN/));
  });
});
