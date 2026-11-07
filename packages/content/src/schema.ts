import { z } from 'zod';

z.config(z.locales.fr());

const requiredText = z.string().trim().min(1, 'Ce champ est obligatoire');
const optionalText = requiredText.nullable().default(null);
const textList = z.array(requiredText).default([]);
const position = z.number().int().min(0);

const SAFE_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:']);

const hasSafeProtocol = (href: string): boolean => {
  try {
    return SAFE_PROTOCOLS.has(new URL(href).protocol);
  } catch {
    return false;
  }
};

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Identifiant invalide : minuscules, chiffres et tirets seulement');

export const safeHrefSchema = requiredText.refine(hasSafeProtocol, 'Lien refusé : https, http, mailto ou tel seulement');

export const periodSchema = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'Période invalide : AAAA ou AAAA-MM');

const linkSchema = z.object({ label: requiredText, href: safeHrefSchema });
const linkList = z.array(linkSchema).default([]);

export const profileSchema = z.object({
  name: requiredText,
  role: requiredText,
  city: requiredText,
  about: optionalText,
  search: z.object({
    contractType: requiredText,
    duration: requiredText,
    start: requiredText,
    location: requiredText,
  }),
  goals: textList,
  motivations: textList,
  frustrations: textList,
  workStyle: z.array(z.object({ quality: requiredText, proof: requiredText })).default([]),
  softSkills: textList,
  hobbies: z.array(z.object({ id: slugSchema, label: requiredText })).default([]),
  cvFile: optionalText,
});

export const contactSchema = z.object({
  email: z.email(),
  phone: requiredText,
  links: linkList,
});

export const experienceSchema = z.object({
  id: slugSchema,
  title: requiredText,
  company: requiredText,
  kind: z.enum(['pro', 'stage', 'alternance', 'freelance']),
  start: periodSchema,
  end: periodSchema.nullable().default(null),
  summary: optionalText,
  missions: textList,
  techs: textList,
  position,
});

export const educationSchema = z.object({
  id: slugSchema,
  degree: requiredText,
  school: requiredText,
  start: periodSchema,
  end: periodSchema.nullable().default(null),
  details: textList,
  position,
});

export const PROJECT_CATEGORY_IDS = ['pro', 'ecole', 'perso'] as const;
const projectCategoryId = z.enum(PROJECT_CATEGORY_IDS);

export const projectCategorySchema = z.object({
  id: projectCategoryId,
  title: requiredText,
  description: requiredText,
  position,
});

export const projectSchema = z.object({
  id: slugSchema,
  title: requiredText,
  categoryId: projectCategoryId,
  summary: requiredText,
  context: optionalText,
  work: optionalText,
  result: optionalText,
  techs: textList,
  links: linkList,
  captures: z.array(z.object({ file: requiredText, alt: requiredText })).default([]),
  hidden: z.boolean().default(false),
  position,
});

export const skillCategorySchema = z.object({
  id: slugSchema,
  title: requiredText,
  skills: textList,
  position,
});

const lists = {
  experiences: z.array(experienceSchema),
  educations: z.array(educationSchema),
  projectCategories: z.array(projectCategorySchema),
  projects: z.array(projectSchema),
  skillCategories: z.array(skillCategorySchema),
};

export const draftStateSchema = z.object({
  profile: profileSchema.nullable(),
  contact: contactSchema.nullable(),
  ...lists,
});

export const draftContentSchema = z.object({
  profile: profileSchema,
  contact: contactSchema,
  ...lists,
});

export const publicSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  publishedAt: z.iso.datetime(),
  content: draftContentSchema,
});

/** Entrée de création : la position est décidée par le serveur. */
export const createInput = <S extends z.ZodRawShape>(schema: z.ZodObject<S>) =>
  schema.omit({ position: true } as never) as z.ZodObject<Omit<S, 'position'>>;

/** Entrée de modification : un identifiant ne change jamais, la position passe par le réordonnancement. */
export const updateInput = <S extends z.ZodRawShape>(schema: z.ZodObject<S>) =>
  schema.omit({ id: true, position: true } as never).strict() as z.ZodObject<Omit<S, 'id' | 'position'>>;

export type Profile = z.infer<typeof profileSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type ProjectCategory = z.infer<typeof projectCategorySchema>;
export type Project = z.infer<typeof projectSchema>;
export type SkillCategory = z.infer<typeof skillCategorySchema>;
export type DraftState = z.infer<typeof draftStateSchema>;
export type DraftContent = z.infer<typeof draftContentSchema>;
export type PublicSnapshot = z.infer<typeof publicSnapshotSchema>;
