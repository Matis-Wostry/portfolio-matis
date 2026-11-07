import { createServer, type Server } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { buildSite } from '../src/build.ts';
import { content, project, snapshot, template } from './fixture.ts';

const CAPTURE = '0f8fad5b-d9cb-469f-a165-70867728950e.png';
const CV = '7c9e6679-7425-40de-944b-e07fc1f90ae7.pdf';

let root: string;
let siteDir: string;
let outDir: string;
let server: Server | null = null;

/** Une fausse API publique : l'instantané, et les médias qu'on lui donne. */
const serve = async (body: unknown, media: Record<string, string> = {}): Promise<string> => {
  server = createServer((request, response) => {
    if (request.url === '/public/snapshot') {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      return;
    }
    const file = request.url?.replace('/public/media/', '') ?? '';
    if (media[file] !== undefined) response.writeHead(200).end(media[file]);
    else response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
};

const withCapture = () => snapshot({ projects: [project({ captures: [{ file: CAPTURE, alt: 'Accueil' }] })] });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'site-classique-'));
  siteDir = join(root, 'site');
  outDir = join(root, 'dist');
  for (const dir of ['style', 'script', 'assets/cv', '.git', '.github', 'content']) mkdirSync(join(siteDir, dir), { recursive: true });
  writeFileSync(join(siteDir, 'index.html'), template());
  writeFileSync(join(siteDir, 'style/style.css'), 'body {}');
  writeFileSync(join(siteDir, 'script/script.js'), '// script');
  writeFileSync(join(siteDir, 'assets/cv/CV_Matis_Wostry.pdf'), 'ancien CV');
  writeFileSync(join(siteDir, '.git/HEAD'), 'ref: refs/heads/main');
  writeFileSync(join(siteDir, 'README.md'), '# CV');
  mkdirSync(outDir);
  writeFileSync(join(outDir, 'ancien.txt'), 'build précédent');
});

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
  rmSync(root, { recursive: true, force: true });
});

const untouched = () => {
  expect(readFileSync(join(siteDir, 'index.html'), 'utf8')).toBe(template());
  expect(readdirSync(outDir)).toEqual(['ancien.txt']);
};

describe('génération depuis l’API', () => {
  test('écrit le site complet, avec les captures, et met à jour le gabarit et la copie du contenu', async () => {
    const api = await serve(withCapture(), { [CAPTURE]: 'image' });
    await buildSite({ siteDir, outDir, source: { api } });

    const html = readFileSync(join(outDir, 'index.html'), 'utf8');
    expect(html).toContain('<h1>WOSTRY <span class="accent">Matis</span></h1>');
    expect(readFileSync(join(outDir, 'assets/media', CAPTURE), 'utf8')).toBe('image');
    expect(readFileSync(join(outDir, 'style/style.css'), 'utf8')).toBe('body {}');
    expect(readFileSync(join(siteDir, 'index.html'), 'utf8')).toBe(html);
    expect(JSON.parse(readFileSync(join(siteDir, 'content/snapshot.json'), 'utf8'))).toEqual(withCapture());
    expect(existsSync(join(outDir, 'ancien.txt'))).toBe(false);
  });

  test('outDir ne contient ni .git, ni .github, ni README.md, ni la copie du contenu', async () => {
    await buildSite({ siteDir, outDir, source: { api: await serve(snapshot()) } });
    expect(readdirSync(outDir).sort()).toEqual(['assets', 'index.html', 'script', 'style']);
  });

  test('les autres pages HTML du site sont publiées telles quelles', async () => {
    writeFileSync(join(siteDir, 'politique-de-confidentialite.html'), '<p>Politique</p>');
    await buildSite({ siteDir, outDir, source: { api: await serve(snapshot()) } });
    expect(readFileSync(join(outDir, 'politique-de-confidentialite.html'), 'utf8')).toBe('<p>Politique</p>');
    expect(existsSync(join(outDir, 'README.md'))).toBe(false);
  });

  test('le CV publié est écrit à assets/cv/CV_Matis_Wostry.pdf', async () => {
    const body = snapshot({ profile: { ...content().profile, cvFile: CV } });
    await buildSite({ siteDir, outDir, source: { api: await serve(body, { [CV]: 'nouveau CV' }) } });
    expect(readFileSync(join(outDir, 'assets/cv/CV_Matis_Wostry.pdf'), 'utf8')).toBe('nouveau CV');
    expect(existsSync(join(outDir, 'assets/media', CV))).toBe(false);
  });

  test('sans CV publié, le site garde le sien', async () => {
    await buildSite({ siteDir, outDir, source: { api: await serve(snapshot()) } });
    expect(readFileSync(join(outDir, 'assets/cv/CV_Matis_Wostry.pdf'), 'utf8')).toBe('ancien CV');
  });
});

describe('échecs, sans rien écrire', () => {
  test('API injoignable : rejet, et siteDir et outDir intacts', async () => {
    await expect(buildSite({ siteDir, outDir, source: { api: 'http://127.0.0.1:1' } })).rejects.toThrow(/API injoignable/);
    untouched();
  });

  test('API sans contenu publié : rejet qui le dit', async () => {
    server = createServer((_request, response) => response.writeHead(404).end());
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const api = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
    await expect(buildSite({ siteDir, outDir, source: { api } })).rejects.toThrow(/404/);
    untouched();
  });

  test('instantané invalide : rejet avant toute écriture', async () => {
    await expect(buildSite({ siteDir, outDir, source: { api: await serve({ schemaVersion: 1, content: {} }) } })).rejects.toThrow(/Instantané invalide/);
    untouched();
  });

  test('média en 404 : rejet avant toute écriture, en nommant le fichier', async () => {
    await expect(buildSite({ siteDir, outDir, source: { api: await serve(withCapture()) } })).rejects.toThrow(CAPTURE);
    untouched();
  });

  test('un marqueur manquant : rejet avant toute écriture', async () => {
    writeFileSync(join(siteDir, 'index.html'), template().replace('<!-- content:skills -->', ''));
    const before = readFileSync(join(siteDir, 'index.html'), 'utf8');
    await expect(buildSite({ siteDir, outDir, source: { api: await serve(snapshot()) } })).rejects.toThrow(/skills/);
    expect(readFileSync(join(siteDir, 'index.html'), 'utf8')).toBe(before);
    expect(readdirSync(outDir)).toEqual(['ancien.txt']);
  });

  test('outDir ne peut pas être le dossier du site', async () => {
    await expect(buildSite({ siteDir, outDir: siteDir, source: { api: await serve(snapshot()) } })).rejects.toThrow(/dossier du site/);
  });
});

describe('développement sans API', () => {
  test('avec un fichier d’instantané, le site se génère sans API', async () => {
    const file = join(root, 'snapshot.json');
    writeFileSync(file, JSON.stringify(snapshot()));
    await buildSite({ siteDir, outDir, source: { snapshotFile: file } });
    expect(readFileSync(join(outDir, 'index.html'), 'utf8')).toContain('WOSTRY');
  });

  test('un fichier d’instantané enregistré avec une marque d’ordre (BOM) est accepté', async () => {
    const file = join(root, 'snapshot.json');
    writeFileSync(file, `﻿${JSON.stringify(snapshot())}`);
    await buildSite({ siteDir, outDir, source: { snapshotFile: file } });
    expect(readFileSync(join(outDir, 'index.html'), 'utf8')).toContain('WOSTRY');
  });

  test('les captures sont prises dans assets/media du site, et une capture absente est signalée sans bloquer', async () => {
    const file = join(root, 'snapshot.json');
    writeFileSync(file, JSON.stringify(withCapture()));
    const result = await buildSite({ siteDir, outDir, source: { snapshotFile: file } });
    expect(result.missingMedia).toEqual([CAPTURE]);

    mkdirSync(join(siteDir, 'assets/media'));
    writeFileSync(join(siteDir, 'assets/media', CAPTURE), 'locale');
    const second = await buildSite({ siteDir, outDir, source: { snapshotFile: file } });
    expect(second.missingMedia).toEqual([]);
    expect(readFileSync(join(outDir, 'assets/media', CAPTURE), 'utf8')).toBe('locale');
  });
});
