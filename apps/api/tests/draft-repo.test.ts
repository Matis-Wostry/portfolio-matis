import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { draftStateSchema } from '@portfolio-matis/content';
import { buildApp } from '../src/app.ts';
import { openDatabase, type Db } from '../src/db/client.ts';
import { createDraftRepo, DuplicateIdError, ReorderMismatchError, seedDraft, type DraftRepo } from '../src/db/draft-repo.ts';
import { draftContent, projectInput, tempDir, testConfig } from './helpers.ts';

let db: Db;
let repo: DraftRepo;

beforeEach(() => {
  db = openDatabase(':memory:');
  repo = createDraftRepo(db);
});

afterEach(() => db.$client.close());

describe('application', () => {
  test('GET /health répond 200', async () => {
    const app = await buildApp(testConfig());
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    await app.close();
  });
});

describe('collections', () => {
  test('create attribue une position à la suite', () => {
    expect(repo.create('projects', projectInput({ id: 'a' })).position).toBe(0);
    expect(repo.create('projects', projectInput({ id: 'b' })).position).toBe(1);
  });

  test('list trie par position', () => {
    repo.create('projects', projectInput({ id: 'a' }));
    repo.create('projects', projectInput({ id: 'b' }));
    repo.reorder('projects', ['b', 'a']);
    expect(repo.list('projects').map((p) => p.id)).toEqual(['b', 'a']);
  });

  test('reorder refuse une liste incomplète ou inconnue', () => {
    repo.create('projects', projectInput({ id: 'a' }));
    repo.create('projects', projectInput({ id: 'b' }));
    expect(() => repo.reorder('projects', ['a'])).toThrow(ReorderMismatchError);
    expect(() => repo.reorder('projects', ['a', 'c'])).toThrow(ReorderMismatchError);
    expect(() => repo.reorder('projects', ['a', 'a'])).toThrow(ReorderMismatchError);
  });

  test('create avec un identifiant existant lève DuplicateIdError', () => {
    repo.create('projects', projectInput());
    expect(() => repo.create('projects', projectInput())).toThrow(DuplicateIdError);
  });

  test('update modifie sans toucher à l’identifiant ni à la position', () => {
    repo.create('projects', projectInput({ id: 'a' }));
    repo.create('projects', projectInput({ id: 'b' }));
    const { id: _id, ...input } = projectInput({ title: 'Nouveau' });
    expect(repo.update('projects', 'b', input)).toMatchObject({ id: 'b', title: 'Nouveau', position: 1 });
  });

  test('update et remove d’un identifiant inconnu le signalent', () => {
    const { id: _id, ...input } = projectInput();
    expect(repo.update('projects', 'inconnu', input)).toBeNull();
    expect(repo.remove('projects', 'inconnu')).toBe(false);
  });

  test('les listes JSON et les valeurs nulles reviennent à l’identique', () => {
    const input = projectInput({ captures: [{ file: 'a.png', alt: 'Accueil' }], context: null, hidden: true });
    repo.create('projects', input);
    expect(repo.get('projects', 'pokedex')).toEqual({ ...input, position: 0 });
  });
});

describe('fiches uniques', () => {
  test('profil et contact sont absents puis remplacés', () => {
    const { profile, contact } = draftContent();
    expect(repo.getProfile()).toBeNull();
    repo.putProfile(profile);
    repo.putProfile({ ...profile, role: 'Autre' });
    expect(repo.getProfile()).toEqual({ ...profile, role: 'Autre' });

    expect(repo.getContact()).toBeNull();
    repo.putContact(contact);
    expect(repo.getContact()).toEqual(contact);
  });
});

describe('état du brouillon', () => {
  test('un brouillon vide reste conforme au schéma', () => {
    expect(draftStateSchema.parse(repo.readState())).toMatchObject({ profile: null, contact: null, projects: [] });
  });

  test('seedDraft remplit une base vide à l’identique', () => {
    const content = draftContent();
    seedDraft(repo, content);
    expect(repo.readState()).toEqual(content);
  });

  test('seedDraft refuse une base non vide et n’y touche pas', () => {
    repo.create('projects', projectInput({ id: 'existant' }));
    expect(() => seedDraft(repo, draftContent())).toThrow(/déjà du contenu/);
    expect(repo.list('projects').map((p) => p.id)).toEqual(['existant']);
  });
});

describe('reprise interrompue', () => {
  test('une erreur en cours de reprise laisse la base vide', () => {
    const doubled = draftContent({ projects: [{ ...projectInput(), position: 0 }, { ...projectInput(), position: 1 }] });
    expect(() => seedDraft(repo, doubled)).toThrow(DuplicateIdError);
    expect(repo.isEmpty()).toBe(true);
  });
});

describe('persistance', () => {
  test('les données survivent à la réouverture du fichier de base', () => {
    const path = join(tempDir(), 'sous-dossier', 'data.db');
    const first = openDatabase(path);
    createDraftRepo(first).create('projects', projectInput({ techs: ['React'] }));
    first.$client.close();

    const second = openDatabase(path);
    expect(createDraftRepo(second).get('projects', 'pokedex')).toMatchObject({ techs: ['React'] });
    second.$client.close();
  });
});
