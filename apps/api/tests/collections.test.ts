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
    const input = projectInput({ captures: [{ file: '0f8fad5b-d9cb-469f-a165-70867728950e.png', alt: 'Accueil' }] });

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
  const category = (id: string, title = id) => ({ id, title, description: `Projets ${title}` });
  const ids = async () => (await call('GET', '/admin/project-categories')).json().map((c: { id: string }) => c.id);

  test('une nouvelle catégorie se crée, se modifie, se range et se supprime', async () => {
    const created = await call('POST', '/admin/project-categories', category('hackathon', 'Hackathons'));
    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({ ...category('hackathon', 'Hackathons'), position: 0 });
    await call('POST', '/admin/project-categories', category('perso'));

    const updated = await call('PUT', '/admin/project-categories/hackathon', { title: 'Hackathons', description: 'En 48 heures' });
    expect(updated.json()).toEqual({ id: 'hackathon', title: 'Hackathons', description: 'En 48 heures', position: 0 });

    expect((await call('POST', '/admin/project-categories/reorder', { ids: ['perso', 'hackathon'] })).statusCode).toBe(204);
    expect(await ids()).toEqual(['perso', 'hackathon']);

    expect((await call('DELETE', '/admin/project-categories/hackathon')).statusCode).toBe(204);
    expect(await ids()).toEqual(['perso']);
  });

  test('un identifiant qui n’est pas en minuscules et tirets répond 400', async () => {
    const response = await call('POST', '/admin/project-categories', category('Mes Projets'));
    expect(response.statusCode).toBe(400);
    expect(response.json().issues[0].path).toBe('id');
  });

  test('un identifiant déjà pris répond 409', async () => {
    await call('POST', '/admin/project-categories', category('perso'));
    expect((await call('POST', '/admin/project-categories', category('perso'))).statusCode).toBe(409);
  });

  test('une catégorie encore utilisée par des projets ne se supprime pas, et le message dit combien', async () => {
    await call('POST', '/admin/project-categories', category('ecole', 'École'));
    await call('POST', '/admin/projects', projectInput({ id: 'a', categoryId: 'ecole' }));
    await call('POST', '/admin/projects', projectInput({ id: 'b', categoryId: 'ecole' }));

    const response = await call('DELETE', '/admin/project-categories/ecole');
    expect(response.statusCode).toBe(409);
    expect(response.json().message).toBe('« École » contient encore 2 projets : changez-les de catégorie avant de la supprimer');
    expect(await ids()).toEqual(['ecole']);
  });

  test('une catégorie inconnue répond 404 sur PUT et DELETE', async () => {
    expect((await call('PUT', '/admin/project-categories/inconnue', { title: 'T', description: 'D' })).statusCode).toBe(404);
    expect((await call('DELETE', '/admin/project-categories/inconnue')).statusCode).toBe(404);
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

describe('contenu devenu non conforme après un changement de schéma', () => {
  const { contact } = draftContent();

  test('le brouillon et les listes restent lisibles, pour pouvoir le corriger', async () => {
    await call('PUT', '/admin/contact', contact);
    await call('POST', '/admin/projects', projectInput());
    app.db.$client.prepare("update contact set email = 'plus-valide'").run();
    app.db.$client.prepare("update projects set category_id = 'ancienne'").run();

    expect((await call('GET', '/admin/draft')).statusCode).toBe(200);
    expect((await call('GET', '/admin/contact')).statusCode).toBe(200);
    const projects = await call('GET', '/admin/projects');
    expect(projects.statusCode).toBe(200);
    expect(projects.json()[0].categoryId).toBe('ancienne');
  });
});

test('GET /admin/draft rassemble tout le brouillon', async () => {
  await call('POST', '/admin/projects', projectInput());
  const draft = (await call('GET', '/admin/draft')).json();
  expect(draft).toMatchObject({ profile: null, contact: null, experiences: [], projects: [{ id: 'pokedex' }] });
});
