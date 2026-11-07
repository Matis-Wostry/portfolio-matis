import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { DraftContent, Project } from '@portfolio-matis/content';
import { buildApp } from '../src/app.ts';
import { hashPassword } from '../src/auth/password.ts';
import type { AppConfig } from '../src/config.ts';

export const ADMIN_ORIGIN = 'https://admin.example.test';
export const TEST_PASSWORD = 'mot-de-passe-de-test';

const passwordHash = hashPassword(TEST_PASSWORD);

export const tempDir = (): string => mkdtempSync(join(tmpdir(), 'portfolio-matis-'));

export const createTestApp = async (over: Partial<AppConfig> = {}): Promise<FastifyInstance> =>
  buildApp(testConfig({ adminPasswordHash: await passwordHash, ...over }));

/** Se connecte et renvoie l'en-tête Cookie à réutiliser. */
export const loginCookie = async (app: FastifyInstance): Promise<string> => {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: { origin: ADMIN_ORIGIN },
    payload: { password: TEST_PASSWORD },
  });
  const cookie = response.cookies.find((c) => c.name === 'session');
  if (!cookie) throw new Error(`Connexion impossible : ${response.statusCode} ${response.body}`);
  return `session=${cookie.value}`;
};

export const testConfig = (over: Partial<AppConfig> = {}): AppConfig => ({
  databasePath: ':memory:',
  mediaDir: tempDir(),
  adminPasswordHash: 'non-utilise',
  sessionSecret: 'x'.repeat(32),
  adminOrigin: ADMIN_ORIGIN,
  cookieSecure: true,
  deploySites: [],
  port: 0,
  ...over,
});

export const projectInput = (over: Partial<Project> = {}): Omit<Project, 'position'> => ({
  id: 'pokedex',
  title: 'Pokédex',
  categoryId: 'ecole',
  summary: 'Une API REST documentée',
  context: null,
  work: null,
  result: null,
  techs: ['React', 'Express'],
  links: [{ label: 'Code', href: 'https://github.com/Matis-Wostry/Pokedex' }],
  captures: [],
  hidden: false,
  ...over,
});

export const draftContent = (over: Partial<DraftContent> = {}): DraftContent => ({
  profile: {
    name: 'Matis Wostry',
    role: 'Développeur full-stack junior',
    city: 'Genève',
    about: null,
    search: { contractType: 'Alternance', duration: '1 an', start: 'Septembre 2027', location: 'Genève' },
    goals: ['Décrocher une alternance'],
    motivations: [],
    frustrations: [],
    workStyle: [{ quality: 'Autonome', proof: 'En freelance.' }],
    softSkills: [],
    hobbies: [{ id: 'echecs', label: 'Échecs' }],
    cvFile: null,
  },
  contact: { email: 'matis@example.com', phone: '+33 6 00 00 00 00', links: [] },
  experiences: [
    {
      id: 'freelance', title: 'Développeur', company: 'Freelance', kind: 'freelance', start: '2025', end: null,
      summary: null, missions: [], techs: [], position: 0,
    },
  ],
  educations: [
    { id: 'but-mmi', degree: 'BUT MMI', school: 'IUT', start: '2022', end: '2025', details: [], position: 0 },
  ],
  projectCategories: [
    { id: 'pro', title: 'Projets pro', description: 'En entreprise', position: 0 },
    { id: 'ecole', title: 'Projets école', description: 'Pendant mes études', position: 1 },
    { id: 'perso', title: 'Projets perso', description: 'Pour apprendre', position: 2 },
  ],
  projects: [{ ...projectInput(), position: 0 }],
  skillCategories: [{ id: 'langages', title: 'Langages', skills: ['HTML'], position: 0 }],
  ...over,
});
