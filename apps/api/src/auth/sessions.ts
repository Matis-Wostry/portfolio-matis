import { createHash, randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { sessions } from '../db/schema.ts';

export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

// Seul le hash du jeton est conservé : lire la base ne permet pas d'ouvrir une session.
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const createSession = (db: Db): string => {
  const now = Date.now();
  db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
  const token = randomBytes(32).toString('base64url');
  db.insert(sessions).values({ tokenHash: hashToken(token), expiresAt: now + SESSION_DURATION_SECONDS * 1000 }).run();
  return token;
};

export const isSessionValid = (db: Db, token: string): boolean => {
  const row = db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(token))).get();
  return row !== undefined && row.expiresAt > Date.now();
};

export const deleteSession = (db: Db, token: string): void => {
  db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token))).run();
};
