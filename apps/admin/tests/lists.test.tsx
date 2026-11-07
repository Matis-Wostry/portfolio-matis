import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { createFakeApi, renderApp } from './helpers.tsx';

const experience = {
  id: 'freelance', title: 'Développeur', company: 'Freelance', kind: 'freelance', start: '2025', end: null,
  summary: null, missions: ['Refondre un site'], techs: ['WordPress'], position: 0,
};
const education = { id: 'but-mmi', degree: 'BUT MMI', school: 'IUT', start: '2022', end: '2025', details: ['Développement web'], position: 0 };
const skill = { id: 'langages', title: 'Langages', skills: ['HTML'], position: 0 };

describe('expériences', () => {
  test('la liste montre le titre et l’entreprise', async () => {
    renderApp('/experiences', createFakeApi({ experiences: [experience] }));
    const list = await screen.findByRole('list', { name: 'Expériences' });
    expect(within(list).getByText('Développeur')).toBeInTheDocument();
    expect(within(list).getByText(/Freelance/)).toBeInTheDocument();
  });

  test('créer une alternance en cours : la fin vide devient nulle', async () => {
    const api = createFakeApi();
    const { user } = renderApp('/experiences/nouveau', api);
    await user.type(await screen.findByLabelText('Titre'), 'Développeur');
    await user.type(screen.getByLabelText('Entreprise'), 'Octoplus Solutions');
    await user.selectOptions(screen.getByLabelText('Type'), 'alternance');
    await user.type(screen.getByLabelText('Début'), '2026-09');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.state.experiences[0]).toMatchObject({ id: 'developpeur', kind: 'alternance', start: '2026-09', end: null, summary: null }));
  });

  test('une période mal écrite est refusée sur son champ', async () => {
    const api = createFakeApi({ experiences: [experience] });
    const { user } = renderApp('/experiences/freelance', api);
    const start = await screen.findByLabelText('Début');
    await user.clear(start);
    await user.type(start, 'août 2024');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText(/Période invalide/)).toBeInTheDocument();
    expect(api.callsTo('PUT /admin/experiences/freelance')).toHaveLength(0);
  });

  test('les missions s’ajoutent, se modifient et se retirent', async () => {
    const api = createFakeApi({ experiences: [experience] });
    const { user } = renderApp('/experiences/freelance', api);
    await user.click(await screen.findByRole('button', { name: 'Ajouter dans Missions' }));
    await user.type(screen.getByLabelText('Missions 2'), 'Suivre le SEO');
    await user.click(screen.getByRole('button', { name: 'Retirer Missions 1' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.state.experiences[0]?.missions).toEqual(['Suivre le SEO']));
  });
});

describe('formations', () => {
  test('modifier le détail d’une formation', async () => {
    const api = createFakeApi({ educations: [education] });
    const { user } = renderApp('/formations/but-mmi', api);
    const detail = await screen.findByLabelText('Détails 1');
    await user.clear(detail);
    await user.type(detail, 'Design');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.state.educations[0]?.details).toEqual(['Design']));
  });

  test('créer une formation déduit l’identifiant du diplôme', async () => {
    const { user } = renderApp('/formations/nouveau', createFakeApi());
    await user.type(await screen.findByLabelText('Diplôme'), 'Bachelor Développement web & IA');
    expect(screen.getByLabelText('Identifiant')).toHaveValue('bachelor-developpement-web-ia');
  });
});

describe('compétences', () => {
  test('ajouter une compétence à une catégorie', async () => {
    const api = createFakeApi({ 'skill-categories': [skill] });
    const { user } = renderApp('/competences/langages', api);
    await user.type(await screen.findByLabelText('Compétences'), 'Python{Enter}');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.state['skill-categories'][0]?.skills).toEqual(['HTML', 'Python']));
  });

  test('une compétence déjà présente n’est pas ajoutée deux fois', async () => {
    const { user } = renderApp('/competences/langages', createFakeApi({ 'skill-categories': [skill] }));
    await user.type(await screen.findByLabelText('Compétences'), 'HTML{Enter}');
    expect(screen.getAllByText('HTML')).toHaveLength(1);
  });
});
