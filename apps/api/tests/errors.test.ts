import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ADMIN_ORIGIN, createTestApp, loginCookie } from './helpers.ts';

let app: FastifyInstance;
let cookie: string;

beforeEach(async () => {
  app = await createTestApp();
  cookie = await loginCookie(app);
});

afterEach(() => app.close());

const post = (url: string, contentType: string, payload: string) =>
  app.inject({ method: 'POST', url, headers: { origin: ADMIN_ORIGIN, cookie, 'content-type': contentType }, payload });

describe('erreurs de requête, en français', () => {
  test('un JSON invalide répond 400 avec un message en français', async () => {
    const response = await post('/admin/projects', 'application/json', '{pas du json');
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe('Le corps de la requête n’est pas un JSON valide');
  });

  test('un corps JSON vide répond 400 avec un message en français', async () => {
    const response = await post('/admin/projects', 'application/json', '');
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe('Le corps de la requête est vide');
  });

  test('un envoi de média sans fichier joint répond 406 avec un message en français', async () => {
    const response = await post('/admin/media', 'application/json', '{}');
    expect(response.statusCode).toBe(406);
    expect(response.json().message).toBe('La requête doit contenir un fichier');
  });
});
