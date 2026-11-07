import { afterAll, beforeAll, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ADMIN_ORIGIN, createTestApp } from './helpers.ts';

const PUBLIC_WRITE_ROUTES = ['POST /auth/login'];

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
  await app.ready();
});

afterAll(() => app.close());

test('toute route d’écriture exige une session, route par route', async () => {
  const routes = app.writeRoutes.filter((route) => !PUBLIC_WRITE_ROUTES.includes(`${route.method} ${route.url}`));
  expect(routes.length).toBeGreaterThan(0);

  for (const route of routes) {
    const response = await app.inject({
      method: route.method as 'POST',
      url: route.url,
      headers: { origin: ADMIN_ORIGIN },
    });
    expect(`${route.method} ${route.url} -> ${response.statusCode}`).toBe(`${route.method} ${route.url} -> 401`);
  }
});

test('toute lecture sous /admin exige une session', async () => {
  const routes = app.adminReadRoutes;
  for (const route of routes) {
    const response = await app.inject({ method: 'GET', url: route });
    expect(`GET ${route} -> ${response.statusCode}`).toBe(`GET ${route} -> 401`);
  }
});
