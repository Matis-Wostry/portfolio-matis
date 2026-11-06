import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { hashPassword, verifyPassword } from '../src/auth/password.ts';
import { sessions } from '../src/db/schema.ts';
import { ADMIN_ORIGIN, createTestApp, loginCookie, tempDir, TEST_PASSWORD } from './helpers.ts';

let app: FastifyInstance;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => app.close());

const login = (password: string, origin = ADMIN_ORIGIN) =>
  app.inject({ method: 'POST', url: '/auth/login', headers: { origin }, payload: { password } });

const me = (cookie?: string) =>
  app.inject({ method: 'GET', url: '/auth/me', headers: cookie ? { cookie } : {} });

describe('mot de passe', () => {
  test('verifyPassword reconnaît le bon et refuse le mauvais', async () => {
    const stored = await hashPassword('bonjour');
    expect(await verifyPassword('bonjour', stored)).toBe(true);
    expect(await verifyPassword('Bonjour', stored)).toBe(false);
  });

  test('deux hachages du même mot de passe diffèrent', async () => {
    expect(await hashPassword('bonjour')).not.toBe(await hashPassword('bonjour'));
  });

  test.each(['', 'pas-un-hash', 'scrypt:sel', 'scrypt:zz:zz'])('un hash stocké invalide (%j) refuse sans planter', async (stored) => {
    expect(await verifyPassword('bonjour', stored)).toBe(false);
  });
});

describe('connexion', () => {
  test('le bon mot de passe pose un cookie HttpOnly, Secure et SameSite=Strict', async () => {
    const response = await login(TEST_PASSWORD);
    expect(response.statusCode).toBe(200);
    const header = String(response.headers['set-cookie']);
    expect(header).toMatch(/^session=/);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Strict');
  });

  test('COOKIE_SECURE=false retire seulement Secure, pour le développement local', async () => {
    const local = await createTestApp({ cookieSecure: false });
    const response = await local.inject({
      method: 'POST', url: '/auth/login', headers: { origin: ADMIN_ORIGIN }, payload: { password: TEST_PASSWORD },
    });
    const header = String(response.headers['set-cookie']);
    expect(header).not.toContain('Secure');
    expect(header).toContain('HttpOnly');
    await local.close();
  });

  test('un mauvais mot de passe répond 401, sans cookie', async () => {
    const response = await login('mauvais');
    expect(response.statusCode).toBe(401);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.json().message).toMatch(/mot de passe/i);
  });

  test('un corps sans mot de passe répond 400, avec le champ en cause', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/login', headers: { origin: ADMIN_ORIGIN }, payload: {} });
    expect(response.statusCode).toBe(400);
    expect(response.json().issues[0].path).toBe('password');
  });

  test('la 6e tentative en 15 minutes répond 429, même avec le bon mot de passe', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login('mauvais')).statusCode).toBe(401);
    }
    const blocked = await login(TEST_PASSWORD);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().message).toMatch(/tentatives/i);
  });
});

describe('limite de tentatives derrière le proxy', () => {
  const attempt = (forwardedFor: string) =>
    app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin: ADMIN_ORIGIN, 'x-forwarded-for': forwardedFor },
      payload: { password: 'mauvais' },
    });

  test('falsifier le début de X-Forwarded-For ne contourne pas la limite', async () => {
    for (let n = 0; n < 5; n += 1) {
      expect((await attempt(`10.0.0.${n}, 203.0.113.9`)).statusCode).toBe(401);
    }
    expect((await attempt('10.0.0.99, 203.0.113.9')).statusCode).toBe(429);
  });

  test('un autre visiteur, vu par le proxy, n’est pas bloqué', async () => {
    for (let n = 0; n < 5; n += 1) await attempt('203.0.113.9');
    expect((await attempt('203.0.113.10')).statusCode).toBe(401);
  });
});

describe('session', () => {
  test('/auth/me répond 401 sans cookie et 200 avec', async () => {
    expect((await me()).statusCode).toBe(401);
    expect((await me(await loginCookie(app))).statusCode).toBe(200);
  });

  test('un cookie modifié répond 401', async () => {
    const cookie = await loginCookie(app);
    expect((await me(`${cookie.slice(0, -2)}xx`)).statusCode).toBe(401);
  });

  test('un jeton non signé répond 401', async () => {
    expect((await me('session=jeton-invente')).statusCode).toBe(401);
  });

  test('le jeton n’est pas stocké en clair', async () => {
    const cookie = await loginCookie(app);
    const token = decodeURIComponent(cookie.replace('session=', '')).split('.')[0];
    const stored = app.db.select().from(sessions).all();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.tokenHash).not.toBe(token);
  });

  test('une session expirée répond 401', async () => {
    const cookie = await loginCookie(app);
    app.db.update(sessions).set({ expiresAt: Date.now() - 1 }).run();
    expect((await me(cookie)).statusCode).toBe(401);
  });

  test('après la déconnexion, le même cookie ne donne plus accès', async () => {
    const cookie = await loginCookie(app);
    const out = await app.inject({ method: 'POST', url: '/auth/logout', headers: { origin: ADMIN_ORIGIN, cookie } });
    expect(out.statusCode).toBe(200);
    expect((await me(cookie)).statusCode).toBe(401);
  });

  test('une connexion efface les sessions expirées', async () => {
    await loginCookie(app);
    app.db.update(sessions).set({ expiresAt: Date.now() - 1 }).run();
    await loginCookie(app);
    expect(app.db.select().from(sessions).all()).toHaveLength(1);
  });
});

describe('changement de mot de passe', () => {
  const restart = async (databasePath: string, adminPasswordHash: string) => {
    const restarted = await createTestApp({ databasePath, adminPasswordHash });
    return restarted;
  };

  const meOn = (target: FastifyInstance, cookie: string) =>
    target.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });

  test('un redémarrage avec le même mot de passe garde la session', async () => {
    const databasePath = join(tempDir(), 'data.db');
    const hash = await hashPassword(TEST_PASSWORD);
    const first = await restart(databasePath, hash);
    const cookie = await loginCookie(first);
    await first.close();

    const second = await restart(databasePath, hash);
    expect((await meOn(second, cookie)).statusCode).toBe(200);
    await second.close();
  });

  test('changer le mot de passe ferme les sessions déjà ouvertes', async () => {
    const databasePath = join(tempDir(), 'data.db');
    const first = await restart(databasePath, await hashPassword(TEST_PASSWORD));
    const cookie = await loginCookie(first);
    await first.close();

    const second = await restart(databasePath, await hashPassword('nouveau-mot-de-passe'));
    expect((await meOn(second, cookie)).statusCode).toBe(401);
    await second.close();
  });
});

describe('origine', () => {
  test('une écriture depuis une autre origine répond 403', async () => {
    expect((await login(TEST_PASSWORD, 'https://evil.example')).statusCode).toBe(403);
  });

  test('une écriture sans origine répond 403', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { password: TEST_PASSWORD } });
    expect(response.statusCode).toBe(403);
  });

  test('une lecture n’a pas besoin d’origine', async () => {
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });

  test('CORS n’autorise que l’interface, avec ses cookies', async () => {
    const preflight = (origin: string) =>
      app.inject({
        method: 'OPTIONS', url: '/auth/login',
        headers: { origin, 'access-control-request-method': 'POST' },
      });
    const allowed = await preflight(ADMIN_ORIGIN);
    expect(allowed.headers['access-control-allow-origin']).toBe(ADMIN_ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect((await preflight('https://evil.example')).headers['access-control-allow-origin']).toBeUndefined();
  });
});
