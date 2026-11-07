import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { draftContentSchema, type DraftContent } from '@portfolio-matis/content';
import { fullMonthName, parsePeriod, slugify } from './text.ts';

type Link = { label: string; href: string };
type Fact = { label: string; value: string };
type TimelineEntry = { period: string; kind: string; title: string; place: string };

type JeuPortfolio = {
  projets: {
    categories: { id: string; title: string; description: string }[];
    cards: { id: string; category: string; title: string; description: string; tags: string[]; links: Link[] }[];
  };
  skills: { board: { title: string; tags: string[] }[] };
  about: {
    persona: {
      name: string;
      role: string;
      facts: Fact[];
      goals: string[];
      motivations: string[];
      frustrations: string[];
      workStyle: { quality: string; proof: string }[];
      timeline: TimelineEntry[];
      hobbies: { label: string }[];
    };
  };
  contact: { links: Link[] };
};

const factValue = (facts: Fact[], label: string): string => {
  const fact = facts.find((f) => f.label === label);
  if (!fact) throw new Error(`Information absente du jeu : ${label}`);
  return fact.value;
};

const parseSearch = (status: string, location: string) => {
  const unreadable = () => new Error(`Statut illisible : « ${status} »`);
  if (!/alternance/i.test(status)) throw unreadable();

  const years = /(\d+)\s+ans/.exec(status);
  const duration = /d['’]un an/.test(status) ? '1 an' : years ? `${years[1]} ans` : null;
  if (!duration) throw unreadable();

  const startMatch = /dès\s+(\S+)\s+(\d{4})/.exec(status);
  const month = startMatch?.[1] ? fullMonthName(startMatch[1]) : undefined;
  if (!startMatch || !month) throw unreadable();

  return { contractType: 'Alternance', duration, start: `${month} ${startMatch[2]}`, location };
};

const experienceKind = (title: string): 'alternance' | 'freelance' | 'pro' => {
  if (/alternance/i.test(title)) return 'alternance';
  return /freelance/i.test(title) ? 'freelance' : 'pro';
};

const toExperience = (entry: TimelineEntry, position: number) => {
  const company = entry.title.split(' · ').at(-1) ?? entry.title;
  return {
    id: slugify(company),
    title: entry.place,
    company,
    kind: experienceKind(entry.title),
    ...parsePeriod(entry.period),
    summary: null,
    missions: [],
    techs: [],
    position,
  };
};

const toEducation = (entry: TimelineEntry, position: number) => ({
  id: slugify(entry.title),
  degree: entry.title,
  school: entry.place,
  ...parsePeriod(entry.period),
  details: [],
  position,
});

const toContact = (links: Link[]) => {
  const email = links.find((l) => l.href.startsWith('mailto:'))?.href.replace('mailto:', '');
  const phone = links.find((l) => l.href.startsWith('tel:'))?.label;
  if (!email || !phone) throw new Error('Email ou téléphone absent du contact du jeu');
  return {
    email,
    phone,
    links: links.filter((l) => !/^(mailto|tel):/.test(l.href)),
  };
};

export const convertJeu = (portfolio: JeuPortfolio): DraftContent => {
  const { persona } = portfolio.about;
  const city = factValue(persona.facts, 'Base');
  return draftContentSchema.parse({
    profile: {
      name: persona.name,
      role: persona.role,
      city,
      about: null,
      search: parseSearch(factValue(persona.facts, 'Statut'), city),
      goals: persona.goals,
      motivations: persona.motivations,
      frustrations: persona.frustrations,
      workStyle: persona.workStyle,
      softSkills: [],
      hobbies: persona.hobbies.map((h) => ({ id: slugify(h.label), label: h.label })),
      cvFile: null,
    },
    contact: toContact(portfolio.contact.links),
    experiences: persona.timeline.filter((t) => t.kind === 'pro').map(toExperience),
    educations: persona.timeline.filter((t) => t.kind === 'etudes').map(toEducation),
    projectCategories: portfolio.projets.categories.map((c, position) => ({ ...c, position })),
    projects: portfolio.projets.cards.map((card, position) => ({
      id: card.id,
      title: card.title,
      categoryId: card.category,
      summary: card.description,
      techs: card.tags,
      links: card.links,
      position,
    })),
    skillCategories: portfolio.skills.board.map((b, position) => ({
      id: slugify(b.title),
      title: b.title,
      skills: b.tags,
      position,
    })),
  });
};

/** Lit le contenu du jeu directement depuis son module de données. */
export const readJeu = async (repoDir: string): Promise<DraftContent> => {
  const url = pathToFileURL(join(repoDir, 'src', 'data', 'portfolio.js')).href;
  const { PORTFOLIO } = (await import(url)) as { PORTFOLIO: JeuPortfolio };
  return convertJeu(PORTFOLIO);
};
