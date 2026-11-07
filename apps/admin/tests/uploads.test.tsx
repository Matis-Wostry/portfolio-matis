import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { createFakeApi, profile, project, renderApp } from './helpers.tsx';

const FILE_1 = '00000000-0000-4000-8000-000000000001.png';
const png = () => new File(['contenu'], 'photo.png', { type: 'image/png' });
const pdf = () => new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' });

describe('captures d’un projet', () => {
  test('envoyer une capture puis écrire son texte alternatif l’enregistre avec le projet', async () => {
    const api = createFakeApi({ projects: [project()] });
    const { user } = renderApp('/projets/pokedex', api);
    await user.upload(await screen.findByLabelText('Ajouter une capture'), png());
    await user.type(await screen.findByLabelText('Texte alternatif de la capture 1'), 'Accueil du Pokédex');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.state.projects[0]?.captures).toEqual([{ file: FILE_1, alt: 'Accueil du Pokédex' }]));
  });

  test('l’image envoyée s’affiche depuis l’API', async () => {
    const { user } = renderApp('/projets/pokedex', createFakeApi({ projects: [project()] }));
    await user.upload(await screen.findByLabelText('Ajouter une capture'), png());
    await screen.findByLabelText('Texte alternatif de la capture 1');
    expect(document.querySelector('.shot img')).toHaveAttribute('src', `/admin/media/${FILE_1}`);
  });

  test('une capture sans texte alternatif ne peut pas être enregistrée', async () => {
    const api = createFakeApi({ projects: [project()] });
    const { user } = renderApp('/projets/pokedex', api);
    await user.upload(await screen.findByLabelText('Ajouter une capture'), png());
    await screen.findByLabelText('Texte alternatif de la capture 1');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Ce champ est obligatoire')).toBeInTheDocument();
    expect(api.callsTo('PUT /admin/projects/pokedex')).toHaveLength(0);
  });

  test.each([
    [413, 'Fichier trop lourd : 5 Mo au plus pour une image, 10 Mo pour un PDF'],
    [415, 'Type de fichier refusé : PNG, JPEG, WebP ou PDF seulement'],
  ])('un envoi refusé en %i affiche la raison et conserve le formulaire', async (status, message) => {
    const api = createFakeApi({ projects: [project()] });
    const { user } = renderApp('/projets/pokedex', api);
    const summary = await screen.findByLabelText('Résumé');
    await user.type(summary, ' modifié');
    api.respondOnce('POST /admin/media', { status, body: { message } });
    await user.upload(screen.getByLabelText('Ajouter une capture'), png());
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(summary).toHaveValue('Une API REST documentée modifié');
  });

  test('retirer une capture la retire du projet', async () => {
    const api = createFakeApi({ projects: [project({ captures: [{ file: FILE_1, alt: 'Accueil' }] })] });
    const { user } = renderApp('/projets/pokedex', api);
    await user.click(await screen.findByRole('button', { name: 'Retirer la capture 1' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.state.projects[0]?.captures).toEqual([]));
  });
});

describe('CV', () => {
  test('envoyer un CV l’enregistre avec la présentation', async () => {
    const api = createFakeApi({ profile: profile() });
    const { user } = renderApp('/presentation', api);
    await user.upload(await screen.findByLabelText('Envoyer le CV'), pdf());
    expect(await screen.findByRole('link', { name: 'Voir le CV actuel' })).toHaveAttribute('href', `/admin/media/${FILE_1}`);
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.state.profile?.cvFile).toBe(FILE_1));
  });
});

describe('page des médias', () => {
  const file = { file: FILE_1, originalName: 'photo.png', mime: 'image/png', size: 2048, createdAt: '2026-11-07T08:00:00.000Z' };

  test('supprimer un média libre le retire, après confirmation', async () => {
    const api = createFakeApi({ media: [file] });
    const { user } = renderApp('/medias', api);
    await user.click(await screen.findByRole('button', { name: 'Supprimer photo.png' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(api.state.media).toEqual([]));
  });

  test('supprimer un média utilisé (409) l’explique', async () => {
    const api = createFakeApi({ media: [file] });
    const { user } = renderApp('/medias', api);
    api.respondOnce(`DELETE /admin/media/${FILE_1}`, { status: 409, body: { message: 'Ce média est encore utilisé par le brouillon ou par la dernière publication' } });
    await user.click(await screen.findByRole('button', { name: 'Supprimer photo.png' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('encore utilisé');
    expect(api.state.media).toHaveLength(1);
  });

  test('sans média, la page le dit', async () => {
    renderApp('/medias', createFakeApi());
    expect(await screen.findByText(/Aucun média/)).toBeInTheDocument();
  });
});
