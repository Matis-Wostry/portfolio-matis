import { randomUUID } from 'node:crypto';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { publicSnapshotSchema, type DraftContent } from '@portfolio-matis/content';
import { buildApp } from '../src/app.ts';
import type { DeploySite } from '../src/config.ts';
import { seedDraft } from '../src/db/draft-repo.ts';
import { media } from '../src/db/schema.ts';
import type { Dispatcher, RunState } from '../src/deploy/dispatcher.ts';
import { ADMIN_ORIGIN, createTestApp, draftContent, loginCookie, projectInput, testConfig } from './helpers.ts';

const CLASSIQUE: DeploySite = { name: 'classique', repo: 'Matis-Wostry/cv', workflow: 'deploy.yml', ref: 'main' };
const JEU: DeploySite = { name: 'jeu', repo: 'Matis-Wostry/portfolio-pixel', workflow: 'deploy.yml', ref: 'main' };

const fakeDispatcher = (options: { failing?: string[]; state?: RunState } = {}) => {
  const dispatched: string[] = [];
  const dispatcher: Dispatcher = {
    dispatch: async (site) => {
      dispatched.push(site.name);
      if (options.failing?.includes(site.name)) throw new Error('GitHub a répondu 403');
    },
    latestRun: async () => ({ state: options.state ?? 'success', url: 'https://github.com/run/1' }),
  };
  return { dispatcher, dispatched };
};

let app: FastifyInstance;

afterEach(() => app.close());

const setup = async (content: DraftContent | null = draftContent()) => {
  app = await createTestApp();
  if (content) seedDraft(app.repo, content);
  return loginCookie(app);
};

const setupWithSites = async (deploySites: DeploySite[], dispatcher: Dispatcher) => {
  const base = await createTestApp();
  const hash = base.config.adminPasswordHash;
  await base.close();
  app = await buildApp(testConfig({ adminPasswordHash: hash, deploySites }), { dispatcher });
  seedDraft(app.repo, draftContent());
  return loginCookie(app);
};

const publish = (cookie: string) =>
  app.inject({ method: 'POST', url: '/admin/publish', headers: { origin: ADMIN_ORIGIN, cookie } });

const status = async (cookie: string) =>
  (await app.inject({ method: 'GET', url: '/admin/status', headers: { cookie } })).json();

const publicSnapshot = () => app.inject({ method: 'GET', url: '/public/snapshot' });
const publicMedia = (file: string) => app.inject({ method: 'GET', url: `/public/media/${file}` });

const addMedia = (mime = 'image/png', extension = 'png') => {
  const file = `${randomUUID()}.${extension}`;
  writeFileSync(join(app.config.mediaDir, file), 'contenu');
  app.db.insert(media).values({ file, originalName: 'x', mime, size: 7, createdAt: '2026-11-06T22:00:00.000Z' }).run();
  return file;
};

const updateProject = (over: Parameters<typeof projectInput>[0]) => {
  const { id: _id, ...input } = projectInput(over);
  app.repo.update('projects', 'pokedex', input);
};

describe('publication', () => {
  test('rien n’est public avant la première publication', async () => {
    await setup();
    expect((await publicSnapshot()).statusCode).toBe(404);
  });

  test('publier rend le contenu public, conforme au schéma', async () => {
    const cookie = await setup();
    const response = await publish(cookie);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ snapshotId: 1, deploys: [] });
    const snapshot = publicSnapshotSchema.parse((await publicSnapshot()).json());
    expect(snapshot.content.projects.map((p) => p.id)).toEqual(['pokedex']);
  });

  test('l’instantané est figé : modifier ensuite le brouillon ne change pas ce qui est public', async () => {
    const cookie = await setup();
    await publish(cookie);
    updateProject({ title: 'Modifié après publication' });
    const snapshot = (await publicSnapshot()).json();
    expect(snapshot.content.projects[0].title).toBe('Pokédex');
  });

  test('le brouillon n’est jamais servi au public', async () => {
    const cookie = await setup();
    await publish(cookie);
    app.repo.create('projects', projectInput({ id: 'nouveau' }));
    const ids = (await publicSnapshot()).json().content.projects.map((p: { id: string }) => p.id);
    expect(ids).not.toContain('nouveau');
  });

  test('un brouillon incomplet répond 409 avec les chemins, sans instantané', async () => {
    const cookie = await setup(null);
    const response = await publish(cookie);
    expect(response.statusCode).toBe(409);
    expect(response.json().issues.map((i: { path: string }) => i.path)).toEqual(['profile', 'contact']);
    expect((await publicSnapshot()).statusCode).toBe(404);
  });

  test('une catégorie absente bloque la publication', async () => {
    const cookie = await setup(draftContent({ projectCategories: [] }));
    const response = await publish(cookie);
    expect(response.statusCode).toBe(409);
    expect(response.json().issues[0].path).toBe('projects.pokedex.categoryId');
  });

  test('une capture dont le média est absent de la base répond 409', async () => {
    const cookie = await setup();
    updateProject({ captures: [{ file: `${randomUUID()}.png`, alt: 'A' }] });
    const response = await publish(cookie);
    expect(response.statusCode).toBe(409);
    expect(response.json().issues[0].path).toMatch(/^media\./);
  });

  test('une capture dont le fichier a disparu du disque répond 409', async () => {
    const cookie = await setup();
    const file = addMedia();
    rmSync(join(app.config.mediaDir, file));
    updateProject({ captures: [{ file, alt: 'A' }] });
    expect((await publish(cookie)).statusCode).toBe(409);
  });

  test('un CV absent bloque la publication', async () => {
    const content = draftContent();
    const cookie = await setup({ ...content, profile: { ...content.profile, cvFile: `${randomUUID()}.pdf` } });
    expect((await publish(cookie)).statusCode).toBe(409);
  });
});

describe('projets masqués et médias', () => {
  test('un projet masqué n’apparaît pas dans l’instantané public', async () => {
    const cookie = await setup();
    updateProject({ hidden: true });
    await publish(cookie);
    expect((await publicSnapshot()).json().content.projects).toEqual([]);
  });

  test('la capture d’un projet masqué n’est pas servie', async () => {
    const cookie = await setup();
    const file = addMedia();
    updateProject({ hidden: true, captures: [{ file, alt: 'A' }] });
    await publish(cookie);
    expect((await publicMedia(file)).statusCode).toBe(404);
  });

  test('un média seulement dans le brouillon n’est pas servi', async () => {
    const cookie = await setup();
    await publish(cookie);
    const file = addMedia();
    updateProject({ captures: [{ file, alt: 'A' }] });
    expect((await publicMedia(file)).statusCode).toBe(404);
  });

  test('un média publié est servi, sans session', async () => {
    const cookie = await setup();
    const file = addMedia();
    updateProject({ captures: [{ file, alt: 'A' }] });
    await publish(cookie);
    const response = await publicMedia(file);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  test('un chemin détourné répond 400', async () => {
    await setup();
    expect((await publicMedia('..%2f..%2fetc%2fpasswd')).statusCode).toBe(400);
  });
});

describe('badge Brouillon', () => {
  test('vrai avant la première publication, faux juste après', async () => {
    const cookie = await setup();
    expect(await status(cookie)).toMatchObject({ hasUnpublishedChanges: true, lastPublishedAt: null });
    await publish(cookie);
    const after = await status(cookie);
    expect(after.hasUnpublishedChanges).toBe(false);
    expect(after.lastPublishedAt).toEqual(expect.any(String));
  });

  test('vrai après une modification, faux après retour à l’identique', async () => {
    const cookie = await setup();
    await publish(cookie);
    updateProject({ title: 'Autre' });
    expect((await status(cookie)).hasUnpublishedChanges).toBe(true);
    updateProject({});
    expect((await status(cookie)).hasUnpublishedChanges).toBe(false);
  });

  test('masquer un projet compte comme une modification', async () => {
    const cookie = await setup();
    await publish(cookie);
    updateProject({ hidden: true });
    expect((await status(cookie)).hasUnpublishedChanges).toBe(true);
  });
});

describe('déclenchement des sites', () => {
  test('la liste vient de la configuration : deux sites, deux déclenchements', async () => {
    const { dispatcher, dispatched } = fakeDispatcher();
    const cookie = await setupWithSites([CLASSIQUE, JEU], dispatcher);
    const response = await publish(cookie);
    expect(dispatched.sort()).toEqual(['classique', 'jeu']);
    expect(response.json().deploys).toEqual(
      expect.arrayContaining([
        { site: 'classique', error: null },
        { site: 'jeu', error: null },
      ]),
    );
  });

  test('un échec garde l’instantané, remonte en failure, et n’empêche pas l’autre site', async () => {
    const { dispatcher, dispatched } = fakeDispatcher({ failing: ['classique'] });
    const cookie = await setupWithSites([CLASSIQUE, JEU], dispatcher);
    const response = await publish(cookie);
    expect(response.statusCode).toBe(200);
    expect(dispatched).toContain('jeu');
    expect((await publicSnapshot()).statusCode).toBe(200);

    const { deploys } = await status(cookie);
    expect(deploys).toEqual(
      expect.arrayContaining([
        { site: 'classique', state: 'failure', url: null, error: 'GitHub a répondu 403' },
        { site: 'jeu', state: 'success', url: 'https://github.com/run/1', error: null },
      ]),
    );
  });

  test('republier sans changement relance les sites', async () => {
    const { dispatcher, dispatched } = fakeDispatcher();
    const cookie = await setupWithSites([CLASSIQUE], dispatcher);
    await publish(cookie);
    await publish(cookie);
    expect(dispatched).toEqual(['classique', 'classique']);
    expect((await status(cookie)).deploys).toHaveLength(1);
  });

  test('l’état suit celui rapporté par GitHub', async () => {
    const { dispatcher } = fakeDispatcher({ state: 'in_progress' });
    const cookie = await setupWithSites([CLASSIQUE], dispatcher);
    await publish(cookie);
    expect((await status(cookie)).deploys[0]).toMatchObject({ site: 'classique', state: 'in_progress' });
  });

  test('un site retiré de la configuration garde un état lisible', async () => {
    const { dispatcher } = fakeDispatcher();
    const cookie = await setupWithSites([CLASSIQUE], dispatcher);
    await publish(cookie);
    app.config.deploySites = [];
    expect((await status(cookie)).deploys[0]).toMatchObject({ site: 'classique', state: 'unknown' });
  });

  test('des sites configurés sans dispatcher empêchent le démarrage', async () => {
    await expect(buildApp(testConfig({ deploySites: [CLASSIQUE] }))).rejects.toThrow(/GITHUB_DISPATCH_TOKEN/);
    app = await createTestApp();
  });
});
