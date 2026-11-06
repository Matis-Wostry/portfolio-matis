import type { DraftContent } from '@portfolio-matis/content';
import type { ClassiqueFacts } from './classique.ts';

export type Ecart = { subject: string; label: string; jeu: string; classique: string };

const ABSENT = 'Absent';

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
  const chambre = jeu.projects.find((p) => p.id === 'chambre-du-dev');

  return [
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
      subject: 'chambre-du-dev',
      label: 'Carte « La Chambre du Dev », à reformuler de façon neutre',
      jeu: chambre?.summary ?? ABSENT,
      classique: ABSENT,
    },
    {
      subject: 'savoir-etre',
      label: 'Savoir-être et façons de travailler',
      jeu: orAbsent(jeu.profile.workStyle.map((w) => `${w.quality} : ${w.proof}`)),
      classique: orAbsent(classique.softSkills),
    },
  ];
};

export const buildProposal = (jeu: DraftContent, classique: ClassiqueFacts): { content: DraftContent; ecarts: Ecart[] } => ({
  content: jeu,
  ecarts: buildEcarts(jeu, classique),
});

export const renderEcarts = (ecarts: Ecart[]): string => {
  const sections = ecarts.map((e) => `## ${e.label}\n\n- **Jeu :** ${e.jeu}\n- **Site classique :** ${e.classique}\n`);
  return [
    '# Écarts entre les deux sites\n',
    'La proposition reprend le contenu du jeu. Ces différences sont à arbitrer avant toute publication.\n',
    ...sections,
  ].join('\n');
};
