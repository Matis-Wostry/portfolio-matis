import { draftContentSchema, type DraftContent } from '@portfolio-matis/content';
import type { ClassiqueFacts } from './classique.ts';
import { parsePeriod, slugify } from './text.ts';

export type Ecart = { subject: string; label: string; jeu: string; classique: string };

const ABSENT = 'Absent';

const ABOUT_TEXT =
  'Développeur full-stack junior, je suis en Bachelor Développement web & IA à CREA Genève et en alternance chez Octoplus Solutions, en parallèle d’une activité de freelance en développement et SEO. J’aime apprendre en construisant et créer des outils utiles au quotidien, notamment pour automatiser ce qui se répète. Je recherche une alternance d’un an à Genève à partir de septembre 2027, pour continuer à monter en compétences sur le web et l’IA.';

const CHAMBRE_DU_DEV_ID = 'chambre-du-dev';
const CHAMBRE_DU_DEV_SUMMARY =
  'Mon portfolio sous forme de jeu : une chambre en pixel art à explorer, avec un moteur d’échecs, des sons synthétisés et un terminal.';

const normalizeHref = (href: string): string => href.trim().replace(/\/+$/, '').toLowerCase();

const orAbsent = (values: string[]): string => (values.length ? values.join(' ; ') : ABSENT);

const skillItems = (lines: string[]): string[] =>
  lines.flatMap((line) => line.split(/[,()]/)).map((item) => item.trim()).filter(Boolean);

const describeExperience = (e: DraftContent['experiences'][number]): string =>
  `${e.title} chez ${e.company} (${e.start} à ${e.end ?? 'aujourd’hui'})`;

export const buildEcarts = (jeu: DraftContent, classique: ClassiqueFacts): Ecart[] => {
  const jeuExperiences = (pattern: RegExp) => jeu.experiences.filter((e) => pattern.test(e.company)).map(describeExperience);
  const classiqueExperiences = (pattern: RegExp) =>
    classique.experiences
      .filter((e) => pattern.test(`${e.title} ${e.company}`))
      .map((e) => `${e.title}, ${e.company} (${e.period})`);

  const jeuHrefs = new Set(jeu.projects.flatMap((p) => p.links.map((l) => normalizeHref(l.href))));
  const unmatchedProjects = classique.projects.filter((p) => !p.hrefs.some((href) => jeuHrefs.has(normalizeHref(href))));

  const jeuSkills = new Set(jeu.skillCategories.flatMap((c) => c.skills.map((s) => s.toLowerCase())));
  const missingSkills = skillItems(classique.skillLines).filter((item) => !jeuSkills.has(item.toLowerCase()));

  const portfolioCard = classique.projects.find((p) => /portfolio/i.test(p.title));
  const github = jeu.contact.links.find((l) => l.href.includes('github.com'))?.href ?? ABSENT;
  const chambre = jeu.projects.find((p) => p.id === CHAMBRE_DU_DEV_ID);

  return [
    {
      subject: 'a-propos',
      label: 'Texte « À propos », réécrit pour correspondre à la recherche',
      jeu: `${ABSENT} ; texte retenu pour les deux sites : ${ABOUT_TEXT}`,
      classique: classique.about || ABSENT,
    },
    { subject: 'email', label: 'Email', jeu: jeu.contact.email, classique: classique.email },
    { subject: 'github', label: 'GitHub', jeu: github, classique: classique.github },
    {
      subject: 'recherche',
      label: 'Recherche',
      jeu: `${jeu.profile.search.contractType}, ${jeu.profile.search.duration}, dès ${jeu.profile.search.start}`,
      classique: classique.availability.join(' ; '),
    },
    {
      subject: 'octoplus',
      label: 'Octoplus Solutions',
      jeu: orAbsent(jeuExperiences(/octoplus/i)),
      classique: orAbsent(classiqueExperiences(/octoplus/i)),
    },
    {
      subject: 'smart-informatique',
      label: 'Smart Informatique',
      jeu: orAbsent(jeuExperiences(/smart informatique/i)),
      classique: orAbsent(classiqueExperiences(/smart informatique/i)),
    },
    {
      subject: 'mieuxdisant',
      label: 'Le MieuxDisant',
      jeu: orAbsent(jeuExperiences(/mieuxdisant/i)),
      classique: orAbsent(classiqueExperiences(/^(?!.*freelance).*mieuxdisant/i)),
    },
    {
      subject: 'freelance',
      label: 'Freelance',
      jeu: orAbsent(jeuExperiences(/freelance/i)),
      classique: orAbsent(classiqueExperiences(/freelance/i)),
    },
    {
      subject: 'projets',
      label: 'Projets absents du jeu',
      jeu: `${jeu.projects.length} projets`,
      classique: orAbsent(unmatchedProjects.map((p) => `${p.title} : ${p.summary}`)),
    },
    {
      subject: 'formations',
      label: 'Détail des formations',
      jeu: jeu.educations.map((e) => `${e.degree}, ${e.school}`).join(' ; '),
      classique: orAbsent(classique.educations.map((e) => `${e.degree} : ${e.details.join(' / ')}`)),
    },
    {
      subject: 'competences',
      label: 'Compétences absentes du jeu',
      jeu: `${jeu.skillCategories.length} catégories, ${jeuSkills.size} mots-clés`,
      classique: orAbsent(missingSkills),
    },
    {
      subject: 'creation-portfolio',
      label: '« Création de mon portfolio »',
      jeu: ABSENT,
      classique: portfolioCard ? `${portfolioCard.title} : ${portfolioCard.summary}` : ABSENT,
    },
    {
      subject: CHAMBRE_DU_DEV_ID,
      label: 'Carte « La Chambre du Dev », reformulée de façon neutre',
      jeu: chambre?.summary ?? ABSENT,
      classique: `${ABSENT} ; texte retenu pour les deux sites : ${CHAMBRE_DU_DEV_SUMMARY}`,
    },
    {
      subject: 'savoir-etre',
      label: 'Savoir-être et façons de travailler',
      jeu: orAbsent(jeu.profile.workStyle.map((w) => `${w.quality} : ${w.proof}`)),
      classique: orAbsent(classique.softSkills),
    },
  ];
};

const samePeriod = (a: { start: string; end: string | null }, b: { start: string; end: string | null }): boolean =>
  a.start === b.start && a.end === b.end;

const withClassiqueDetails = (jeu: DraftContent, classique: ClassiqueFacts): DraftContent['educations'] => {
  const details = classique.educations.map((education) => {
    const match = jeu.educations.find((e) => samePeriod(e, parsePeriod(education.period)));
    if (!match) throw new Error(`Formation du classique sans équivalent dans le jeu : « ${education.degree} »`);
    return { id: match.id, details: education.details };
  });
  return jeu.educations.map((e) => ({ ...e, details: details.find((d) => d.id === e.id)?.details ?? e.details }));
};

const withSmartInformatique = (jeu: DraftContent, classique: ClassiqueFacts): DraftContent['experiences'] => {
  const stage = classique.experiences.find((e) => /smart informatique/i.test(e.company));
  if (!stage) return jeu.experiences;
  const experience = {
    id: slugify(stage.company),
    title: stage.title,
    company: stage.company,
    kind: 'stage' as const,
    ...parsePeriod(stage.period),
    summary: stage.summary || null,
    missions: stage.missions,
    techs: stage.techs,
    position: 0,
  };
  // Le parcours va du plus ancien au plus récent, et ce stage précède l'alternance.
  return [experience, ...jeu.experiences].map((e, position) => ({ ...e, position }));
};

/** Le contenu du jeu, complété par ce que Matis a choisi de reprendre du site classique. */
export const buildProposal = (jeu: DraftContent, classique: ClassiqueFacts): { content: DraftContent; ecarts: Ecart[] } => ({
  content: draftContentSchema.parse({
    ...jeu,
    profile: { ...jeu.profile, about: ABOUT_TEXT, softSkills: classique.softSkills },
    experiences: withSmartInformatique(jeu, classique),
    educations: withClassiqueDetails(jeu, classique),
    projects: jeu.projects.map((p) => (p.id === CHAMBRE_DU_DEV_ID ? { ...p, summary: CHAMBRE_DU_DEV_SUMMARY } : p)),
  }),
  ecarts: buildEcarts(jeu, classique),
});

export const renderEcarts = (ecarts: Ecart[]): string => {
  const sections = ecarts.map((e) => `## ${e.label}\n\n- **Jeu :** ${e.jeu}\n- **Site classique :** ${e.classique}\n`);
  return [
    '# Écarts entre les deux sites\n',
    'La proposition reprend le contenu du jeu, complété par le stage Smart Informatique, le détail des formations et les savoir-être du site classique, avec un texte « À propos » et une carte « La Chambre du Dev » réécrits et validés. Les valeurs du jeu priment pour le reste. Ce qui n’est pas repris reste ici comme trace, notamment les compétences absentes du jeu et « Création de mon portfolio ». À relire avant toute publication.\n',
    ...sections,
  ].join('\n');
};
