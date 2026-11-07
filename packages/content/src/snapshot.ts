import type { DraftContent, DraftState, PublicSnapshot } from './schema.ts';

export type PublishIssue = { path: string; message: string };

const LIST_KEYS = ['experiences', 'educations', 'projectCategories', 'projects', 'skillCategories'] as const;

const byPosition = <T extends { position: number }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.position - b.position);

export const findPublishIssues = (state: DraftState): PublishIssue[] => {
  const issues: PublishIssue[] = [];
  if (!state.profile) issues.push({ path: 'profile', message: 'La présentation n’est pas remplie' });
  if (!state.contact) issues.push({ path: 'contact', message: 'Le contact n’est pas rempli' });

  const categories = new Set(state.projectCategories.map((c) => c.id));
  for (const project of state.projects) {
    if (!categories.has(project.categoryId)) {
      issues.push({
        path: `projects.${project.id}.categoryId`,
        message: `La catégorie « ${project.categoryId} » n’existe pas`,
      });
    }
  }
  return issues;
};

export const toPublicSnapshot = (content: DraftContent, publishedAt: string): PublicSnapshot => ({
  schemaVersion: 1,
  publishedAt,
  content: {
    profile: content.profile,
    contact: content.contact,
    experiences: byPosition(content.experiences),
    educations: byPosition(content.educations),
    projectCategories: byPosition(content.projectCategories),
    projects: byPosition(content.projects).filter((project) => !project.hidden),
    skillCategories: byPosition(content.skillCategories),
  },
});

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, entry]) => [key, sortKeys(entry)]),
    );
  }
  return value;
};

/** Forme comparable d'un brouillon : seul l'ordre relatif des lignes compte, pas leur numéro. */
export const canonicalContent = (state: DraftState): string => {
  const normalized: Record<string, unknown> = { profile: state.profile, contact: state.contact };
  for (const key of LIST_KEYS) {
    normalized[key] = byPosition<{ position: number }>(state[key]).map((item, position) => ({ ...item, position }));
  }
  return JSON.stringify(sortKeys(normalized));
};

export const collectMediaFiles = (state: DraftState): string[] => {
  const files = state.projects.flatMap((project) => project.captures.map((capture) => capture.file));
  if (state.profile?.cvFile) files.push(state.profile.cvFile);
  return [...new Set(files)];
};
