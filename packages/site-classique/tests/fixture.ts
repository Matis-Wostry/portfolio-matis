import type { DraftContent, Project, PublicSnapshot } from '@portfolio-matis/content';
import { SECTIONS } from '../src/render.ts';

export const project = (over: Partial<Project> = {}): Project => ({
  id: 'pokedex',
  title: 'Pokédex',
  categoryId: 'ecole',
  summary: 'Une API REST documentée',
  context: null,
  work: null,
  result: null,
  techs: [],
  links: [],
  captures: [],
  hidden: false,
  position: 0,
  ...over,
});

export const content = (over: Partial<DraftContent> = {}): DraftContent => ({
  profile: {
    name: 'Matis Wostry',
    role: 'Développeur full-stack junior',
    city: 'Genève',
    about: 'Premier paragraphe.\n\nSecond paragraphe.',
    search: { contractType: 'Alternance', duration: '1 an', start: 'Septembre 2027', location: 'Genève' },
    goals: ['Décrocher une alternance'],
    motivations: ['Apprendre en construisant'],
    frustrations: ['Les tâches répétitives'],
    workStyle: [{ quality: 'Autonome', proof: 'En freelance.' }],
    softSkills: ['Patient', 'Rigoureux'],
    hobbies: [{ id: 'basket', label: 'Basket' }, { id: 'lecture', label: 'Lecture' }],
    cvFile: null,
  },
  contact: {
    email: 'matis@example.com',
    phone: '+33 6 00 00 00 00',
    links: [{ label: 'GitHub', href: 'https://github.com/Matis-Wostry' }],
  },
  experiences: [
    { id: 'octoplus', title: 'Développeur', company: 'Octoplus Solutions', kind: 'alternance', start: '2026-09', end: null, summary: 'Alternance', missions: ['Développer'], techs: ['React'], position: 0 },
    { id: 'smart', title: 'Stage', company: 'Smart Informatique', kind: 'stage', start: '2024', end: '2024', summary: null, missions: [], techs: [], position: 1 },
  ],
  educations: [{ id: 'crea', degree: 'Bachelor', school: 'CREA Genève', start: '2025', end: '2028', details: ['Programmation'], position: 0 }],
  projectCategories: [
    { id: 'pro', title: 'Projets pro', description: 'En entreprise', position: 0 },
    { id: 'ecole', title: 'Projets école', description: 'Pendant mes études', position: 1 },
    { id: 'perso', title: 'Projets perso', description: 'Pour apprendre', position: 2 },
  ],
  projects: [project()],
  skillCategories: [{ id: 'langages', title: 'Langages', skills: ['HTML', 'CSS'], position: 0 }],
  ...over,
});

export const snapshot = (over: Partial<DraftContent> = {}): PublicSnapshot => ({
  schemaVersion: 1,
  publishedAt: '2026-11-07T10:00:00.000Z',
  content: content(over),
});

/** Un gabarit minimal : chaque section entre ses marqueurs, autour d'un texte fixe. */
export const template = (): string =>
  [
    '<!DOCTYPE html>',
    '<html lang="fr">',
    '<head>',
    ...SECTIONS.slice(0, 1).map((id) => `    <!-- content:${id} --><meta property="og:description" content="ancien"><!-- /content:${id} -->`),
    '</head>',
    '<body>',
    '    <p class="hors-marqueurs">Ce texte ne bouge pas.</p>',
    ...SECTIONS.slice(1).flatMap((id) => [`    <!-- content:${id} -->`, '    <p>ancien</p>', `    <!-- /content:${id} -->`]),
    '</body>',
    '</html>',
    '',
  ].join('\n');
