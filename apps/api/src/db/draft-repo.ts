import { asc, eq } from 'drizzle-orm';
import type {
  Contact,
  DraftContent,
  DraftState,
  Education,
  Experience,
  Profile,
  Project,
  ProjectCategory,
  SkillCategory,
} from '@portfolio-matis/content';
import type { Db } from './client.ts';
import { contact, educations, experiences, profile, projectCategories, projects, skillCategories } from './schema.ts';

export class DuplicateIdError extends Error {
  constructor(id: string) {
    super(`L’identifiant « ${id} » existe déjà`);
  }
}

export class ReorderMismatchError extends Error {
  constructor() {
    super('La liste doit contenir chaque identifiant existant une seule fois');
  }
}

type Collections = {
  experiences: Experience;
  educations: Education;
  projects: Project;
  skillCategories: SkillCategory;
  projectCategories: ProjectCategory;
};

export type CollectionName = keyof Collections;

const TABLES = { experiences, educations, projects, skillCategories, projectCategories };

const SINGLETON_ID = 1;

export type DraftRepo = {
  getProfile(): Profile | null;
  putProfile(value: Profile): void;
  getContact(): Contact | null;
  putContact(value: Contact): void;
  readState(): DraftState;
  isEmpty(): boolean;
  list<C extends CollectionName>(collection: C): Collections[C][];
  get<C extends CollectionName>(collection: C, id: string): Collections[C] | null;
  create<C extends CollectionName>(collection: C, input: Omit<Collections[C], 'position'>): Collections[C];
  update<C extends CollectionName>(collection: C, id: string, input: Omit<Collections[C], 'id' | 'position'>): Collections[C] | null;
  remove(collection: CollectionName, id: string): boolean;
  reorder(collection: CollectionName, ids: string[]): void;
  /** Exécute `work` en une seule transaction : une erreur annule tout. */
  transaction<T>(work: () => T): T;
};

const withoutId = <T extends { id: unknown }>(row: T | undefined): Omit<T, 'id'> | null => {
  if (!row) return null;
  const { id: _id, ...rest } = row;
  return rest;
};

export const createDraftRepo = (db: Db): DraftRepo => {
  // Le type de chaque méthode publique garantit la cohérence entre une collection et sa table.
  const table = (collection: CollectionName) => TABLES[collection] as typeof projects;

  const list = <C extends CollectionName>(collection: C) =>
    db.select().from(table(collection)).orderBy(asc(table(collection).position)).all() as unknown as Collections[C][];

  const get = <C extends CollectionName>(collection: C, id: string) =>
    (db.select().from(table(collection)).where(eq(table(collection).id, id)).get() ?? null) as Collections[C] | null;

  const repo: DraftRepo = {
    getProfile: () => withoutId(db.select().from(profile).get()),
    putProfile: (value) => {
      const row = { id: SINGLETON_ID, ...value };
      db.insert(profile).values(row).onConflictDoUpdate({ target: profile.id, set: row }).run();
    },
    getContact: () => withoutId(db.select().from(contact).get()),
    putContact: (value) => {
      const row = { id: SINGLETON_ID, ...value };
      db.insert(contact).values(row).onConflictDoUpdate({ target: contact.id, set: row }).run();
    },
    readState: () => ({
      profile: repo.getProfile(),
      contact: repo.getContact(),
      experiences: list('experiences'),
      educations: list('educations'),
      projectCategories: list('projectCategories'),
      projects: list('projects'),
      skillCategories: list('skillCategories'),
    }),
    isEmpty: () =>
      !repo.getProfile() && !repo.getContact() && (Object.keys(TABLES) as CollectionName[]).every((c) => list(c).length === 0),
    list,
    get,
    create: (collection, input) => {
      const { id } = input as { id: string };
      if (get(collection, id)) throw new DuplicateIdError(id);
      const last = list(collection).at(-1);
      const row = { ...input, position: last ? last.position + 1 : 0 };
      db.insert(table(collection)).values(row as never).run();
      return row as never;
    },
    update: (collection, id, input) => {
      if (!get(collection, id)) return null;
      db.update(table(collection)).set(input as never).where(eq(table(collection).id, id)).run();
      return get(collection, id);
    },
    remove: (collection, id) =>
      db.delete(table(collection)).where(eq(table(collection).id, id)).run().changes > 0,
    reorder: (collection, ids) => {
      const existing = list(collection).map((row) => (row as { id: string }).id);
      const sameIds = ids.length === existing.length && new Set(ids).size === ids.length && ids.every((id) => existing.includes(id));
      if (!sameIds) throw new ReorderMismatchError();
      db.transaction((tx) => {
        ids.forEach((id, position) => {
          tx.update(table(collection)).set({ position }).where(eq(table(collection).id, id)).run();
        });
      });
    },
    transaction: (work) => db.$client.transaction(work)(),
  };
  return repo;
};

/** Remplit une base vide avec un contenu déjà validé, en une seule transaction. */
export const seedDraft = (repo: DraftRepo, content: DraftContent): void => {
  if (!repo.isEmpty()) throw new Error('La base contient déjà du contenu : reprise refusée');
  const byPosition = <T extends { position: number }>(rows: T[]) => [...rows].sort((a, b) => a.position - b.position);

  repo.transaction(() => {
    repo.putProfile(content.profile);
    repo.putContact(content.contact);
    for (const row of byPosition(content.experiences)) repo.create('experiences', row);
    for (const row of byPosition(content.educations)) repo.create('educations', row);
    for (const row of byPosition(content.projectCategories)) repo.create('projectCategories', row);
    for (const row of byPosition(content.projects)) repo.create('projects', row);
    for (const row of byPosition(content.skillCategories)) repo.create('skillCategories', row);
  });
};
