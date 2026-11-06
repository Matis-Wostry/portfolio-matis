import { desc } from 'drizzle-orm';
import { draftContentSchema, type DraftContent } from '@portfolio-matis/content';
import type { Db } from './client.ts';
import { snapshots } from './schema.ts';

export type StoredSnapshot = { id: number; publishedAt: string; content: DraftContent };

/** Fige le contenu complet, projets masqués compris : c'est la lecture publique qui les retire. */
export const insertSnapshot = (db: Db, content: DraftContent, publishedAt: string): StoredSnapshot => {
  const { id } = db.insert(snapshots).values({ publishedAt, content: JSON.stringify(content) }).returning({ id: snapshots.id }).get();
  return { id, publishedAt, content };
};

export const latestSnapshot = (db: Db): StoredSnapshot | null => {
  const row = db.select().from(snapshots).orderBy(desc(snapshots.id)).limit(1).get();
  if (!row) return null;
  return { id: row.id, publishedAt: row.publishedAt, content: draftContentSchema.parse(JSON.parse(row.content)) };
};
