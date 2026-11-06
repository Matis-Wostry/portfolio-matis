import { describe, expect, test } from 'vitest';
import {
  createInput,
  draftContentSchema,
  experienceSchema,
  periodSchema,
  projectSchema,
  safeHrefSchema,
  slugSchema,
  updateInput,
} from '../src/index.ts';
import { content } from './fixture.ts';

const minimalProject = { id: 'pokedex', title: 'Pokédex', categoryId: 'ecole', summary: 'API REST', position: 0 };

describe('projet', () => {
  test('ne demande que son titre, son identifiant, son résumé et sa catégorie', () => {
    const p = projectSchema.parse(minimalProject);
    expect(p).toMatchObject({ hidden: false, context: null, work: null, result: null, techs: [], links: [], captures: [] });
  });

  test.each(['id', 'title', 'summary', 'categoryId'])('refuse un projet sans %s', (field) => {
    const { [field as keyof typeof minimalProject]: _removed, ...rest } = minimalProject;
    expect(projectSchema.safeParse(rest).success).toBe(false);
  });

  test('un résumé fait seulement d’espaces est refusé', () => {
    expect(projectSchema.safeParse({ ...minimalProject, summary: '   ' }).success).toBe(false);
  });

  test('une capture exige un texte alternatif', () => {
    const captures = [{ file: 'a.png', alt: '' }];
    expect(projectSchema.safeParse({ ...minimalProject, captures }).success).toBe(false);
  });

  test('une catégorie hors de pro, ecole, perso est refusée', () => {
    expect(projectSchema.safeParse({ ...minimalProject, categoryId: 'autre' }).success).toBe(false);
  });
});

describe('liens', () => {
  test.each(['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'java\nscript:alert(1)', 'data:text/html,x', 'vbscript:x', '', '/relatif'])(
    'refuse %j',
    (href) => {
      expect(safeHrefSchema.safeParse(href).success).toBe(false);
    },
  );

  test.each(['https://a.fr', 'http://a.fr', 'mailto:a@b.fr', 'tel:+33634896232'])('accepte %s', (href) => {
    expect(safeHrefSchema.safeParse(href).success).toBe(true);
  });
});

describe('identifiants et périodes', () => {
  test.each(['Mon Projet', 'Pokedex', 'a--b', '-a', 'a-', 'é'])('refuse l’identifiant %s', (id) => {
    expect(slugSchema.safeParse(id).success).toBe(false);
  });

  test.each(['pokedex', 'mb-home', 'a1'])('accepte l’identifiant %s', (id) => {
    expect(slugSchema.safeParse(id).success).toBe(true);
  });

  test.each(['2024', '2024-08', '2024-12'])('accepte la période %s', (period) => {
    expect(periodSchema.safeParse(period).success).toBe(true);
  });

  test.each(['2024-13', '2024-00', '24', 'août 2024'])('refuse la période %s', (period) => {
    expect(periodSchema.safeParse(period).success).toBe(false);
  });

  test('une expérience en cours a une fin nulle et son résumé est facultatif', () => {
    const e = experienceSchema.parse({ id: 'a', title: 'Dev', company: 'X', kind: 'pro', start: '2025', end: null, position: 0 });
    expect(e).toMatchObject({ end: null, summary: null, missions: [], techs: [] });
  });
});

describe('entrées de création et de modification', () => {
  test('la création ne prend pas la position, le serveur la décide', () => {
    const parsed = createInput(projectSchema).parse({ ...minimalProject, position: 99 });
    expect(parsed).not.toHaveProperty('position');
  });

  test('la modification refuse d’emblée un identifiant', () => {
    expect(updateInput(projectSchema).shape).not.toHaveProperty('id');
    expect(updateInput(projectSchema).shape).not.toHaveProperty('position');
  });
});

test('un contenu complet passe draftContentSchema, sans profil non', () => {
  expect(draftContentSchema.safeParse(content()).success).toBe(true);
  expect(draftContentSchema.safeParse({ ...content(), profile: null }).success).toBe(false);
});
