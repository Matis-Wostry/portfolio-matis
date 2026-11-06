import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ADMIN_ORIGIN, createTestApp, draftContent, loginCookie, projectInput } from './helpers.ts';

let app: FastifyInstance;
let cookie: string;

beforeEach(async () => {
  app = await createTestApp();
  cookie = await loginCookie(app);
});

afterEach(() => app.close());

const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) =>
  app.inject({ method, url, headers: { origin: ADMIN_ORIGIN, cookie }, ...(payload ? { payload } : {}) });

const withoutId = ({ id: _id, ...rest }: ReturnType<typeof projectInput>) => rest;

describe('projets', () => {
  test('cycle complet, listes JSON comprises', async () => {
    const input = projectInput({ captures: [{ file: 'a.png', alt: 'Accueil' }] });

    const created = await call('POST', '/admin/projects', input);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({ ...input, position: 0 });

    expect((await call('GET', '/admin/projects')).json()).toEqual([{ ...input, position: 0 }]);
    expect((await call('GET', '/admin/projects/pokedex')).json().title).toBe('Pokédex');

    const updated = await call('PUT', '/admin/projects/pokedex', { ...withoutId(input), title: 'Nouveau' });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ id: 'pokedex', title: 'Nouveau', position: 0 });

    expect((await call('DELETE', '/admin/projects/pokedex')).statusCode).toBe(204);
    expect((await call('GET', '/admin/projects/pokedex')).statusCode).toBe(404);
  });

  test('seuls titre, identifiant, résumé et catégorie sont demandés', async () => {
    const response = await call('POST', '/admin/projects', { id: 'minimal', title: 'T', summary: 'R', categoryId: 'perso' });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ hidden: false, context: null, techs: [], position: 0 });
  });

  test('la position envoyée à la création est ignorée', async () => {
    await call('POST', '/admin/projects', projectInput({ id: 'a' }));
    const response = await call('POST', '/admin/projects', { ...projectInput({ id: 'b' }), position: 42 });
    expect(response.json().position).toBe(1);
  });

  test('un identifiant déjà pris répond 409', async () => {
    await call('POST', '/admin/projects', projectInput());
    const response = await call('POST', '/admin/projects', projectInput());
    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain('pokedex');
  });

  test('PUT avec un champ id répond 400 : un identifiant ne change jamais', async () => {
    await call('POST', '/admin/projects', projectInput());
    const response = await call('PUT', '/admin/projects/pokedex', projectInput({ id: 'autre' }));
    expect(response.statusCode).toBe(400);
    expect((await call('GET', '/admin/projects/pokedex')).statusCode).toBe(200);
    expect((await call('GET', '/admin/projects/autre')).statusCode).toBe(404);
  });

  test('un lien javascript: répond 400 avec le chemin du champ', async () => {
    const response = await call('POST', '/admin/projects', projectInput({ links: [{ label: 'X', href: 'javascript:alert(1)' }] }));
    expect(response.statusCode).toBe(400);
    expect(response.json().issues[0].path).toBe('links.0.href');
  });

  test('un identifiant inconnu répond 404 sur PUT et DELETE', async () => {
    expect((await call('PUT', '/admin/projects/inconnu', withoutId(projectInput()))).statusCode).toBe(404);
    expect((await call('DELETE', '/admin/projects/inconnu')).statusCode).toBe(404);
  });

  test('reorder change l’ordre de la liste', async () => {
    await call('POST', '/admin/projects', projectInput({ id: 'a' }));
    await call('POST', '/admin/projects', projectInput({ id: 'b' }));
    expect((await call('POST', '/admin/projects/reorder', { ids: ['b', 'a'] })).statusCode).toBe(204);
    expect((await call('GET', '/admin/projects')).json().map((p: { id: string }) => p.id)).toEqual(['b', 'a']);
  });

  test('reorder incomplet répond 400 et ne change rien', async () => {
    await call('POST', '/admin/projects', projectInput({ id: 'a' }));
    await call('POST', '/admin/projects', projectInput({ id: 'b' }));
    expect((await call('POST', '/admin/projects/reorder', { ids: ['b'] })).statusCode).toBe(400);
    expect((await call('GET', '/admin/projects')).json().map((p: { id: string }) => p.id)).toEqual(['a', 'b']);
  });
});

describe('autres collections', () => {
  const { experiences, educations, skillCategories } = draftContent();

  test.each([
    ['experiences', experiences[0]],
    ['educations', educations[0]],
    ['skill-categories', skillCategories[0]],
  ])('%s : création, lecture, suppression', async (path, row) => {
    const { position: _position, ...input } = row as { position: number; id: string };
    expect((await call('POST', `/admin/${path}`, input)).statusCode).toBe(201);
    expect((await call('GET', `/admin/${path}/${input.id}`)).json()).toEqual({ ...input, position: 0 });
    expect((await call('DELETE', `/admin/${path}/${input.id}`)).statusCode).toBe(204);
  });
});

describe('catégories de projets', () => {
  test('PUT remplit une catégorie fixe, à sa place', async () => {
    const response = await call('PUT', '/admin/project-categories/perso', { title: 'Perso', description: 'Pour apprendre' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: 'perso', title: 'Perso', description: 'Pour apprendre', position: 2 });
    await call('PUT', '/admin/project-categories/pro', { title: 'Pro', description: 'En entreprise' });
    expect((await call('GET', '/admin/project-categories')).json().map((c: { id: string }) => c.id)).toEqual(['pro', 'perso']);
  });

  test('une catégorie hors des trois identifiants répond 400', async () => {
    const response = await call('PUT', '/admin/project-categories/autre', { title: 'T', description: 'D' });
    expect(response.statusCode).toBe(400);
  });

  test('elle n’a ni création ni suppression', async () => {
    expect((await call('POST', '/admin/project-categories', { title: 'T', description: 'D' })).statusCode).toBe(404);
    expect((await call('DELETE', '/admin/project-categories/pro')).statusCode).toBe(404);
  });
});

describe('présentation et contact', () => {
  const { profile, contact } = draftContent();

  test('absents au départ, puis remplacés', async () => {
    expect((await call('GET', '/admin/profile')).statusCode).toBe(404);
    expect((await call('PUT', '/admin/profile', profile)).statusCode).toBe(200);
    expect((await call('GET', '/admin/profile')).json()).toEqual(profile);

    expect((await call('GET', '/admin/contact')).statusCode).toBe(404);
    expect((await call('PUT', '/admin/contact', contact)).statusCode).toBe(200);
    expect((await call('GET', '/admin/contact')).json()).toEqual(contact);
  });

  test('un email invalide répond 400', async () => {
    const response = await call('PUT', '/admin/contact', { ...contact, email: 'pas-un-email' });
    expect(response.statusCode).toBe(400);
    expect(response.json().issues[0].path).toBe('email');
  });
});

test('GET /admin/draft rassemble tout le brouillon', async () => {
  await call('POST', '/admin/projects', projectInput());
  const draft = (await call('GET', '/admin/draft')).json();
  expect(draft).toMatchObject({ profile: null, contact: null, experiences: [], projects: [{ id: 'pokedex' }] });
});
