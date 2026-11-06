import { afterAll, beforeAll, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers.ts';

let app: FastifyInstance;
let spec: { info: { title: string }; paths: Record<string, Record<string, { requestBody?: { content: Record<string, { schema: { properties: object; required: string[] } }> } }>> };

beforeAll(async () => {
  app = await createTestApp();
  spec = (await app.inject({ method: 'GET', url: '/docs/json' })).json();
});

afterAll(() => app.close());

test('la documentation est publique et porte le nom du projet', () => {
  expect(spec.info.title).toContain('Portfolio Matis');
});

test('elle est générée depuis les schémas : le corps de POST /admin/projects est décrit', () => {
  const body = spec.paths['/admin/projects']?.post?.requestBody?.content['application/json']?.schema;
  expect(body?.required).toEqual(expect.arrayContaining(['id', 'title', 'summary', 'categoryId']));
  expect(Object.keys(body?.properties ?? {})).toContain('captures');
});

test('elle couvre la connexion et les médias', () => {
  expect(spec.paths['/auth/login']?.post).toBeDefined();
  expect(spec.paths['/admin/media']?.post).toBeDefined();
});

test('la page Swagger UI s’ouvre', async () => {
  const response = await app.inject({ method: 'GET', url: '/docs/' });
  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toContain('text/html');
});
