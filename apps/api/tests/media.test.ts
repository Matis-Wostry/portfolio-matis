import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { insertSnapshot } from '../src/db/snapshots.ts';
import { ADMIN_ORIGIN, createTestApp, draftContent, loginCookie, projectInput, tempDir } from './helpers.ts';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/7yMK/gAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'latin1');
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(512)]);
const SVG = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const MEGABYTE = 1024 * 1024;

let app: FastifyInstance;
let cookie: string;
let mediaDir: string;

beforeEach(async () => {
  mediaDir = tempDir();
  app = await createTestApp({ mediaDir });
  cookie = await loginCookie(app);
});

afterEach(() => app.close());

const upload = (filename: string, content: Buffer, type = 'application/octet-stream') => {
  const boundary = '----portfolio';
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return app.inject({
    method: 'POST',
    url: '/admin/media',
    headers: { origin: ADMIN_ORIGIN, cookie, 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload,
  });
};

const remove = (file: string) =>
  app.inject({ method: 'DELETE', url: `/admin/media/${file}`, headers: { origin: ADMIN_ORIGIN, cookie } });

const read = (file: string) => app.inject({ method: 'GET', url: `/admin/media/${file}`, headers: { cookie } });

describe('envoi', () => {
  test.each([
    ['photo.png', PNG, 'image/png', /\.png$/],
    ['cv.pdf', PDF, 'application/pdf', /\.pdf$/],
  ])('accepte %s', async (name, content, mime, extension) => {
    const response = await upload(name, content);
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({ originalName: name, mime, size: content.length });
    expect(body.file).toMatch(extension);
    expect(existsSync(join(mediaDir, body.file))).toBe(true);
  });

  test('le type vient du contenu, pas du nom ni de l’en-tête', async () => {
    const response = await upload('faux.pdf', PNG, 'application/pdf');
    expect(response.json()).toMatchObject({ mime: 'image/png' });
    expect(response.json().file).toMatch(/\.png$/);
  });

  test.each([
    ['virus.png', EXE],
    ['image.svg', SVG],
    ['texte.png', Buffer.from('juste du texte')],
  ])('refuse %s en 415, sans rien écrire', async (name, content) => {
    const response = await upload(name, content);
    expect(response.statusCode).toBe(415);
    expect(response.json().message).toMatch(/PNG/);
    expect(readdirSync(mediaDir)).toEqual([]);
  });

  test('une image de plus de 5 Mo répond 413, sans rien écrire', async () => {
    const response = await upload('grande.png', Buffer.concat([PNG, Buffer.alloc(5 * MEGABYTE)]));
    expect(response.statusCode).toBe(413);
    expect(response.json().message).toContain('5 Mo');
    expect(readdirSync(mediaDir)).toEqual([]);
  });

  test('un PDF de plus de 5 Mo mais de moins de 10 Mo est accepté', async () => {
    const response = await upload('cv.pdf', Buffer.concat([PDF, Buffer.alloc(6 * MEGABYTE)]));
    expect(response.statusCode).toBe(201);
  });

  test('un fichier de plus de 10 Mo répond 413', async () => {
    const response = await upload('enorme.pdf', Buffer.concat([PDF, Buffer.alloc(10 * MEGABYTE)]));
    expect(response.statusCode).toBe(413);
    expect(readdirSync(mediaDir)).toEqual([]);
  });

  test('le nom d’origine ne se retrouve jamais dans le chemin', async () => {
    const response = await upload('../../evil.png', PNG);
    const { file, originalName } = response.json();
    expect(file).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(originalName).toBe('evil.png');
    expect(readdirSync(mediaDir)).toEqual([file]);
  });

  test('une requête sans fichier répond 400', async () => {
    const boundary = '----vide';
    const response = await app.inject({
      method: 'POST',
      url: '/admin/media',
      headers: { origin: ADMIN_ORIGIN, cookie, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: `--${boundary}\r\nContent-Disposition: form-data; name="champ"\r\n\r\nvaleur\r\n--${boundary}--\r\n`,
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('lecture', () => {
  test('rend le fichier avec son type, sans interprétation par le navigateur', async () => {
    const { file } = (await upload('photo.png', PNG)).json();
    const response = await read(file);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.rawPayload.equals(PNG)).toBe(true);
  });

  test('la liste donne les fichiers envoyés', async () => {
    const { file } = (await upload('photo.png', PNG)).json();
    const response = await app.inject({ method: 'GET', url: '/admin/media', headers: { cookie } });
    expect(response.json()).toEqual([expect.objectContaining({ file, originalName: 'photo.png' })]);
  });

  test.each(['..%2f..%2fetc%2fpasswd', '..%5c..%5cwindows', 'pas-un-uuid.png'])('refuse le chemin %s', async (path) => {
    const response = await read(path);
    expect(response.statusCode).toBe(400);
  });

  test('un fichier inconnu répond 404', async () => {
    expect((await read('00000000-0000-4000-8000-000000000000.png')).statusCode).toBe(404);
  });

  test('un média connu de la base mais disparu du disque répond 404, pas 500', async () => {
    const { file } = (await upload('photo.png', PNG)).json();
    rmSync(join(mediaDir, file));
    const response = await read(file);
    expect(response.statusCode).toBe(404);
    expect(response.json().message).toContain(file);
  });
});

describe('suppression', () => {
  test('un média libre disparaît du disque et de la liste', async () => {
    const { file } = (await upload('photo.png', PNG)).json();
    expect((await remove(file)).statusCode).toBe(204);
    expect(existsSync(join(mediaDir, file))).toBe(false);
    expect((await read(file)).statusCode).toBe(404);
  });

  test('un média utilisé par un projet du brouillon répond 409 et reste', async () => {
    const { file } = (await upload('photo.png', PNG)).json();
    app.repo.create('projects', projectInput({ captures: [{ file, alt: 'Accueil' }] }));
    const response = await remove(file);
    expect(response.statusCode).toBe(409);
    expect(existsSync(join(mediaDir, file))).toBe(true);
  });

  test('le CV du brouillon est protégé', async () => {
    const { file } = (await upload('cv.pdf', PDF)).json();
    const { profile } = draftContent();
    app.repo.putProfile({ ...profile, cvFile: file });
    expect((await remove(file)).statusCode).toBe(409);
  });

  test('un média retiré du brouillon mais encore publié répond 409', async () => {
    const { file } = (await upload('photo.png', PNG)).json();
    insertSnapshot(app.db, draftContent({ projects: [{ ...projectInput({ captures: [{ file, alt: 'A' }] }), position: 0 }] }), '2026-11-06T22:00:00.000Z');
    expect((await remove(file)).statusCode).toBe(409);
  });

  test('un fichier inconnu répond 404', async () => {
    expect((await remove('00000000-0000-4000-8000-000000000000.png')).statusCode).toBe(404);
  });
});
