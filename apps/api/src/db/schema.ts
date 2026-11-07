import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Contact, Experience, Profile, Project } from '@portfolio-matis/content';

// Les propriétés portent les mêmes noms que le schéma Zod : une ligne est directement un objet du contenu.

const json = <T>(name: string) => text(name, { mode: 'json' }).$type<T>().notNull();

export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  city: text('city').notNull(),
  about: text('about'),
  search: json<Profile['search']>('search'),
  goals: json<string[]>('goals'),
  motivations: json<string[]>('motivations'),
  frustrations: json<string[]>('frustrations'),
  workStyle: json<Profile['workStyle']>('work_style'),
  softSkills: json<string[]>('soft_skills'),
  hobbies: json<Profile['hobbies']>('hobbies'),
  cvFile: text('cv_file'),
});

export const contact = sqliteTable('contact', {
  id: integer('id').primaryKey(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  links: json<Contact['links']>('links'),
});

export const experiences = sqliteTable('experiences', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  company: text('company').notNull(),
  kind: text('kind').$type<Experience['kind']>().notNull(),
  start: text('start').notNull(),
  end: text('end'),
  summary: text('summary'),
  missions: json<string[]>('missions'),
  techs: json<string[]>('techs'),
  position: integer('position').notNull(),
});

export const educations = sqliteTable('educations', {
  id: text('id').primaryKey(),
  degree: text('degree').notNull(),
  school: text('school').notNull(),
  start: text('start').notNull(),
  end: text('end'),
  details: json<string[]>('details'),
  position: integer('position').notNull(),
});

export const projectCategories = sqliteTable('project_categories', {
  id: text('id').$type<Project['categoryId']>().primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  position: integer('position').notNull(),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  categoryId: text('category_id').$type<Project['categoryId']>().notNull(),
  summary: text('summary').notNull(),
  context: text('context'),
  work: text('work'),
  result: text('result'),
  techs: json<string[]>('techs'),
  links: json<Project['links']>('links'),
  captures: json<Project['captures']>('captures'),
  hidden: integer('hidden', { mode: 'boolean' }).notNull(),
  position: integer('position').notNull(),
});

export const skillCategories = sqliteTable('skill_categories', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  skills: json<string[]>('skills'),
  position: integer('position').notNull(),
});

export const snapshots = sqliteTable('snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publishedAt: text('published_at').notNull(),
  content: text('content').notNull(),
});

export const media = sqliteTable('media', {
  file: text('file').primaryKey(),
  originalName: text('original_name').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  createdAt: text('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
});

export const deploys = sqliteTable('deploys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  snapshotId: integer('snapshot_id')
    .notNull()
    .references(() => snapshots.id),
  site: text('site').notNull(),
  dispatchedAt: text('dispatched_at').notNull(),
  error: text('error'),
});
