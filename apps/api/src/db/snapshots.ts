import { desc } from 'drizzle-orm';
import { draftContentSchema, type DraftContent } from '@portfolio-matis/content';
import type { Db } from './client.ts';
import { snapshots } from './schema.ts';

export type StoredSnapshot = { id: number; publishedAt: string; content: DraftContent };

/** Le dernier instantané a été publié avec un schéma qui a changé depuis : il faut republier. */
export class StaleSnapshotError extends Error {
  statusCode = 409;

  constructor() {
    super('Le dernier contenu publié ne correspond plus au schéma actuel : republiez le contenu');
  }
}

/** Fige le contenu complet, projets masqués compris : c'est la lecture publique qui les retire. */
export const insertSnapshot = (db: Db, content: DraftContent, publishedAt: string): StoredSnapshot => {
  const { id } = db.insert(snapshots).values({ publishedAt, content: JSON.stringify(content) }).returning({ id: snapshots.id }).get();
  return { id, publishedAt, content };
};

const latestRow = (db: Db) => db.select().from(snapshots).orderBy(desc(snapshots.id)).limit(1).get();

export const latestSnapshotInfo = (db: Db): { id: number; publishedAt: string } | null => {
  const row = latestRow(db);
  return row ? { id: row.id, publishedAt: row.publishedAt } : null;
};

/** Lit le dernier instantané ; lève `StaleSnapshotError` s'il n'est plus conforme au schéma. */
export const latestSnapshot = (db: Db): StoredSnapshot | null => {
  const row = latestRow(db);
  if (!row) return null;
  const parsed = draftContentSchema.safeParse(JSON.parse(row.content));
  if (!parsed.success) throw new StaleSnapshotError();
  return { id: row.id, publishedAt: row.publishedAt, content: parsed.data };
};
