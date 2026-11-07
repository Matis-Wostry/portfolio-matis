import { screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { contact, createFakeApi, profile, renderApp } from './helpers.tsx';

describe('présentation', () => {
  test('édite la recherche et le texte de présentation', async () => {
    const api = createFakeApi({ profile: profile() });
    const { user } = renderApp('/presentation', api);
    const duration = await screen.findByLabelText('Durée');
    await user.clear(duration);
    await user.type(duration, '2 ans');
    await user.clear(screen.getByLabelText('À propos'));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.state.profile).toMatchObject({ about: null, search: { duration: '2 ans', location: 'Genève' } }));
  });

  test('édite objectifs, motivations, frustrations et savoir-être', async () => {
    const api = createFakeApi({ profile: profile() });
    const { user } = renderApp('/presentation', api);
    await user.click(await screen.findByRole('button', { name: 'Ajouter dans Objectifs' }));
    await user.type(screen.getByLabelText('Objectifs 2'), 'Monter en compétence');
    await user.click(screen.getByRole('button', { name: 'Retirer Frustrations 1' }));
    await user.type(screen.getByLabelText('Savoir-être'), 'Curieux{Enter}');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(api.state.profile).toMatchObject({
        goals: ['Décrocher une alternance', 'Monter en compétence'],
        frustrations: [],
        softSkills: ['Patient', 'Curieux'],
      }),
    );
  });

  test('édite les façons de travailler', async () => {
    const api = createFakeApi({ profile: profile() });
    const { user } = renderApp('/presentation', api);
    await user.click(await screen.findByRole('button', { name: 'Ajouter une façon de travailler' }));
    await user.type(screen.getByLabelText('Qualité 2'), 'Curieux');
    await user.type(screen.getByLabelText('Preuve 2'), 'Toujours un œil sur les tendances.');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(api.state.profile?.workStyle).toEqual([
        { quality: 'Autonome', proof: 'En freelance.' },
        { quality: 'Curieux', proof: 'Toujours un œil sur les tendances.' },
      ]),
    );
  });

  test('un nouveau loisir reçoit un identifiant stable, l’ancien garde le sien', async () => {
    const api = createFakeApi({ profile: profile({ hobbies: [{ id: 'echecs', label: 'Échecs' }] }) });
    const { user } = renderApp('/presentation', api);
    const existing = await screen.findByLabelText('Loisir 1');
    await user.clear(existing);
    await user.type(existing, 'Jeu d’échecs');
    await user.click(screen.getByRole('button', { name: 'Ajouter un loisir' }));
    await user.type(screen.getByLabelText('Loisir 2'), 'Jeux vidéo');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(api.state.profile?.hobbies).toEqual([
        { id: 'echecs', label: 'Jeu d’échecs' },
        { id: 'jeux-video', label: 'Jeux vidéo' },
      ]),
    );
  });

  test('une présentation pas encore remplie s’ouvre vide et s’enregistre', async () => {
    const api = createFakeApi();
    const { user } = renderApp('/presentation', api);
    await user.click(await screen.findByRole('button', { name: 'Enregistrer' }));
    expect((await screen.findAllByText('Ce champ est obligatoire')).length).toBeGreaterThan(0);
    await user.type(screen.getByLabelText('Nom'), 'Matis');
    await user.type(screen.getByLabelText('Rôle'), 'Dev');
    await user.type(screen.getByLabelText('Ville'), 'Genève');
    await user.type(screen.getByLabelText('Type de contrat'), 'Alternance');
    await user.type(screen.getByLabelText('Durée'), '1 an');
    await user.type(screen.getByLabelText('Début'), 'Septembre 2027');
    await user.type(screen.getByLabelText('Lieu'), 'Genève');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.state.profile).toMatchObject({ name: 'Matis', cvFile: null, about: null }));
  });
});

describe('contact', () => {
  test('édite l’email, le téléphone et les liens', async () => {
    const api = createFakeApi({ contact: contact() });
    const { user } = renderApp('/contact', api);
    const email = await screen.findByLabelText('Email');
    await user.clear(email);
    await user.type(email, 'autre@example.com');
    await user.type(screen.getByLabelText('Libellé du lien 1'), ' perso');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(api.state.contact).toMatchObject({
        email: 'autre@example.com',
        links: [{ label: 'GitHub perso', href: 'https://github.com/Matis-Wostry' }],
      }),
    );
  });

  test('un email invalide est refusé sur son champ', async () => {
    const api = createFakeApi({ contact: contact() });
    const { user } = renderApp('/contact', api);
    const email = await screen.findByLabelText('Email');
    await user.clear(email);
    await user.type(email, 'pas-un-email');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(api.callsTo('PUT /admin/contact')).toHaveLength(0);
  });
});
