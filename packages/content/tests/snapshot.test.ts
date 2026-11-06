import { describe, expect, test } from 'vitest';
import {
  canonicalContent,
  collectMediaFiles,
  findPublishIssues,
  publicSnapshotSchema,
  toPublicSnapshot,
} from '../src/index.ts';
import { content, project } from './fixture.ts';

const NOW = '2026-11-06T22:00:00.000Z';

describe('toPublicSnapshot', () => {
  test('retire les projets masqués', () => {
    const snap = toPublicSnapshot(content({ projects: [project(), project({ id: 'secret', hidden: true, position: 1 })] }), NOW);
    expect(snap.content.projects.map((p) => p.id)).toEqual(['pokedex']);
  });

  test('trie chaque liste par position', () => {
    const snap = toPublicSnapshot(
      content({ projects: [project({ id: 'b', position: 1 }), project({ id: 'a', position: 0 })] }),
      NOW,
    );
    expect(snap.content.projects.map((p) => p.id)).toEqual(['a', 'b']);
  });

  test('produit un instantané conforme à son schéma', () => {
    const snap = toPublicSnapshot(content(), NOW);
    expect(publicSnapshotSchema.parse(snap)).toMatchObject({ schemaVersion: 1, publishedAt: NOW });
  });
});

describe('findPublishIssues', () => {
  test('un contenu complet ne pose aucun problème', () => {
    expect(findPublishIssues(content())).toEqual([]);
  });

  test('signale le profil absent, le contact absent et la catégorie inconnue', () => {
    const issues = findPublishIssues({
      ...content({ projectCategories: [] }),
      profile: null,
      contact: null,
    });
    expect(issues.map((i) => i.path)).toEqual(['profile', 'contact', 'projects.pokedex.categoryId']);
  });
});

describe('canonicalContent', () => {
  test('ne dépend pas de l’ordre des clés', () => {
    const base = content();
    const shuffled = { ...content(), contact: { links: [], phone: base.contact.phone, email: base.contact.email } };
    expect(canonicalContent(shuffled)).toBe(canonicalContent(base));
  });

  test('ne dépend pas de l’ordre des lignes', () => {
    const a = project({ id: 'a', position: 0 });
    const b = project({ id: 'b', position: 1 });
    expect(canonicalContent(content({ projects: [b, a] }))).toBe(canonicalContent(content({ projects: [a, b] })));
  });

  test('ignore les trous de numérotation mais pas un changement d’ordre', () => {
    const a = project({ id: 'a', position: 0 });
    const b = project({ id: 'b', position: 1 });
    const gap = project({ id: 'b', position: 7 });
    const swapped = project({ id: 'a', position: 2 });
    expect(canonicalContent(content({ projects: [a, gap] }))).toBe(canonicalContent(content({ projects: [a, b] })));
    expect(canonicalContent(content({ projects: [swapped, b] }))).not.toBe(canonicalContent(content({ projects: [a, b] })));
  });

  test('change quand un texte change', () => {
    expect(canonicalContent(content({ projects: [project({ summary: 'Autre' })] }))).not.toBe(canonicalContent(content()));
  });
});

describe('collectMediaFiles', () => {
  test('liste les captures et le CV une seule fois', () => {
    const base = content();
    const files = collectMediaFiles({
      ...base,
      profile: { ...base.profile, cvFile: 'cv.pdf' },
      projects: [
        project({ captures: [{ file: 'a.png', alt: 'A' }, { file: 'b.png', alt: 'B' }] }),
        project({ id: 'autre', captures: [{ file: 'a.png', alt: 'A encore' }] }),
      ],
    });
    expect(files.sort()).toEqual(['a.png', 'b.png', 'cv.pdf']);
  });

  test('accepte un brouillon sans profil', () => {
    expect(collectMediaFiles({ ...content(), profile: null })).toEqual([]);
  });
});
