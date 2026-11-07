import type { DraftContent, Project } from '../src/index.ts';

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
    about: null,
    search: { contractType: 'Alternance', duration: '1 an', start: 'Septembre 2027', location: 'Genève' },
    goals: [],
    motivations: [],
    frustrations: [],
    workStyle: [],
    softSkills: [],
    hobbies: [],
    cvFile: null,
  },
  contact: { email: 'matis@example.com', phone: '+33 6 00 00 00 00', links: [] },
  experiences: [],
  educations: [],
  projectCategories: [
    { id: 'pro', title: 'Projets pro', description: 'En entreprise', position: 0 },
    { id: 'ecole', title: 'Projets école', description: 'Pendant mes études', position: 1 },
    { id: 'perso', title: 'Projets perso', description: 'Pour apprendre', position: 2 },
  ],
  projects: [project()],
  skillCategories: [],
  ...over,
});
