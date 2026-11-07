import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { draftContentSchema, type DraftContent } from '@portfolio-matis/content';
// @ts-expect-error Le module de données du jeu est du JavaScript sans types.
import { PORTFOLIO as jeuPortfolio } from './fixtures/jeu/src/data/portfolio.js';
import {
  buildProposal,
  convertJeu,
  parsePeriod,
  readClassique,
  readJeu,
  renderEcarts,
  slugify,
  type Ecart,
} from '../src/index.ts';

const fixtures = join(import.meta.dirname, 'fixtures');

let content: DraftContent;
let ecarts: Ecart[];

beforeAll(async () => {
  const jeu = await readJeu(join(fixtures, 'jeu'));
  const classique = readClassique(await readFile(join(fixtures, 'classique', 'index.html'), 'utf8'));
  ({ content, ecarts } = buildProposal(jeu, classique));
});

const ecart = (subject: string) => {
  const found = ecarts.find((e) => e.subject === subject);
  if (!found) throw new Error(`écart absent : ${subject}`);
  return found;
};

describe('proposition', () => {
  test('passe draftContentSchema', () => {
    expect(() => draftContentSchema.parse(content)).not.toThrow();
  });

  test('conserve les identifiants de projet du jeu', () => {
    expect(content.projects.map((p) => p.id)).toEqual(['pokedex', 'chambre-du-dev']);
  });

  test('reprend le résumé, les technos, les liens et la catégorie d’un projet', () => {
    expect(content.projects[0]).toMatchObject({
      categoryId: 'ecole',
      summary: 'Une API REST et une interface React.',
      techs: ['React', 'Express'],
      links: [{ label: 'Code', href: 'https://github.com/Matis-Wostry/Pokedex' }],
      hidden: false,
      position: 0,
    });
  });

  test('sépare le parcours en expériences et formations', () => {
    expect(content.educations.map((e) => e.degree)).toEqual(['BUT MMI']);
    expect(content.experiences).toEqual([
      expect.objectContaining({ id: 'smart-informatique', kind: 'stage', position: 0 }),
      expect.objectContaining({ id: 'le-mieuxdisant', title: 'Intégrateur web', company: 'Le MieuxDisant', start: '2024', end: '2025', position: 1 }),
      expect.objectContaining({ id: 'freelance', title: 'Développeur et SEO', company: 'Freelance', kind: 'freelance', start: '2025', end: '2027', position: 2 }),
    ]);
  });

  test('une alternance du jeu garde son type', () => {
    expect(content.experiences.find((e) => e.id === 'le-mieuxdisant')?.kind).toBe('alternance');
  });

  test('une expérience du jeu qui n’est ni alternance ni freelance reste de type pro', () => {
    const entry = { period: '2024–2025', kind: 'pro', title: 'Acme', place: 'Développeur' };
    const converted = convertJeu({
      ...jeuPortfolio,
      about: { persona: { ...jeuPortfolio.about.persona, timeline: [entry] } },
    });
    expect(converted.experiences[0]?.kind).toBe('pro');
  });

  test('déduit la recherche du statut du jeu', () => {
    expect(content.profile.search).toEqual({
      contractType: 'Alternance',
      duration: '1 an',
      start: 'Septembre 2027',
      location: 'Genève',
    });
  });

  test('sépare l’email et le téléphone des autres liens', () => {
    expect(content.contact).toEqual({
      email: 'matis.wostry@crea-inseec.com',
      phone: '+33 6 34 89 62 32',
      links: [{ label: 'GitHub', href: 'https://github.com/Matis-Wostry' }],
    });
  });

  test('donne des identifiants stables aux loisirs et aux compétences, sans leur présentation', () => {
    expect(content.profile.hobbies).toEqual([{ id: 'echecs', label: 'Échecs' }, { id: 'jeux-video', label: 'Jeux vidéo' }]);
    expect(content.skillCategories[1]).toEqual({ id: 'donnees-api', title: 'Données & API', skills: ['SQL', 'MongoDB'], position: 1 });
  });

  test('n’invente aucun texte absent des deux sites', () => {
    expect(content.experiences.find((e) => e.id === 'le-mieuxdisant')).toMatchObject({ summary: null, missions: [], techs: [] });
  });

  test('reprend le stage Smart Informatique du classique, avec ses missions et ses technos', () => {
    expect(content.experiences[0]).toEqual({
      id: 'smart-informatique',
      title: 'Stage – Développeur web',
      company: 'Smart Informatique',
      kind: 'stage',
      start: '2024',
      end: '2024',
      summary: 'Stage de 8 semaines',
      missions: ['Création d’un site WordPress', 'Tests de compatibilité'],
      techs: ['WordPress', 'Canva'],
      position: 0,
    });
  });

  test('reprend le détail des formations, rapproché par les dates, en gardant le titre du jeu', () => {
    expect(content.educations[0]).toMatchObject({
      degree: 'BUT MMI',
      school: 'IUT Dijon-Auxerre',
      details: ['Développement Web'],
    });
  });

  test('une formation du classique sans équivalent interrompt l’import plutôt que de la perdre', async () => {
    const classique = readClassique(await readFile(join(fixtures, 'classique', 'index.html'), 'utf8'));
    const jeu = await readJeu(join(fixtures, 'jeu'));
    expect(() => buildProposal({ ...jeu, educations: [] }, classique)).toThrow(/BUT MMI/);
  });

  test('utilise le texte « À propos » validé, cohérent avec la recherche', () => {
    expect(content.profile.about).toBe(
      'Développeur full-stack junior, je suis en Bachelor Développement web & IA à CREA Genève et en alternance chez Octoplus Solutions, en parallèle d’une activité de freelance en développement et SEO. J’aime apprendre en construisant et créer des outils utiles au quotidien, notamment pour automatiser ce qui se répète. Je recherche une alternance d’un an à Genève à partir de septembre 2027, pour continuer à monter en compétences sur le web et l’IA.',
    );
  });

  test('reprend les savoir-être du classique', () => {
    expect(content.profile.softSkills).toEqual(['Autonomie', 'Patient']);
  });

  test('la carte « La Chambre du Dev » a un texte neutre, valable sur les deux sites', () => {
    const summary = content.projects.find((p) => p.id === 'chambre-du-dev')?.summary;
    expect(summary).toBe('Mon portfolio sous forme de jeu : une chambre en pixel art à explorer, avec un moteur d’échecs, des sons synthétisés et un terminal.');
  });

  test('l’ancien texte de la carte et le nouveau restent en trace dans les écarts', () => {
    expect(ecart('chambre-du-dev').jeu).toBe('Ce portfolio : une chambre en pixel art.');
    expect(ecart('chambre-du-dev').classique).toContain('Mon portfolio sous forme de jeu');
  });

  test('ne reprend ni le projet ni les compétences, gardés en trace dans les écarts', () => {
    expect(ecart('creation-portfolio').classique).toContain('Création de mon portfolio');
    expect(ecart('competences').classique).toContain('MyPoseo');
    expect(content.projects.map((p) => p.title)).not.toContain('Création de mon portfolio');
    expect(content.skillCategories.flatMap((c) => c.skills)).not.toContain('MyPoseo');
  });
});

describe('écarts', () => {
  test('les 13 sujets de la spec et le texte « À propos » sont signalés', () => {
    expect(ecarts.map((e) => e.subject).sort()).toEqual(
      ['a-propos', 'chambre-du-dev', 'competences', 'creation-portfolio', 'email', 'formations', 'freelance', 'github',
        'mieuxdisant', 'octoplus', 'projets', 'recherche', 'savoir-etre', 'smart-informatique'].sort(),
    );
  });

  test('l’ancien texte « À propos » et le nouveau restent en trace dans les écarts', () => {
    expect(ecart('a-propos').classique).toBe('Je recherche une collaboration de deux ans.');
    expect(ecart('a-propos').jeu).toContain('Développeur full-stack junior');
  });

  test('les deux valeurs de l’email sont présentes', () => {
    expect(ecart('email')).toMatchObject({ jeu: 'matis.wostry@crea-inseec.com', classique: 'matis.wostry@crea-insee.com' });
  });

  test('une compétence présente seulement sur le classique est proposée, pas perdue', () => {
    expect(ecart('competences').classique).toContain('MyPoseo');
    expect(ecart('competences').classique).not.toContain('Python');
  });

  test('un projet du classique est rapproché par un lien commun, même avec une barre finale', () => {
    expect(ecart('projets').classique).toContain('Création de mon portfolio');
    expect(ecart('projets').classique).not.toContain('Application Pokédex');
  });

  test('Smart Informatique et le détail des formations restent consultables', () => {
    expect(ecart('smart-informatique').classique).toContain('Smart Informatique');
    expect(ecart('formations').classique).toContain('Développement Web');
  });

  test('renderEcarts donne une section par sujet, avec les deux versions', () => {
    const markdown = renderEcarts(ecarts);
    expect(markdown.match(/^## /gm)).toHaveLength(14);
    expect(markdown).toContain('matis.wostry@crea-insee.com');
  });
});

describe('conversions', () => {
  test.each([
    ['2024–2025', { start: '2024', end: '2025' }],
    ['2022 - 2025', { start: '2022', end: '2025' }],
    ['Aout 2024 - Septembre 2025', { start: '2024-08', end: '2025-09' }],
    ["2025 - Aujourd'hui", { start: '2025', end: null }],
    ['2024', { start: '2024', end: '2024' }],
  ])('parsePeriod(%s)', (period, expected) => {
    expect(parsePeriod(period)).toEqual(expected);
  });

  test('une période illisible interrompt l’import au lieu d’être inventée', () => {
    expect(() => parsePeriod('bientôt')).toThrow(/bientôt/);
  });

  test('un statut illisible interrompt l’import', async () => {
    await expect(readJeu(join(fixtures, 'jeu-illisible'))).rejects.toThrow(/Statut/);
  });

  test.each([
    ['Frameworks & CMS', 'frameworks-cms'],
    ['Échecs', 'echecs'],
    ['Alternance · Le MieuxDisant', 'alternance-le-mieuxdisant'],
  ])('slugify(%s)', (text, slug) => {
    expect(slugify(text)).toBe(slug);
  });
});
