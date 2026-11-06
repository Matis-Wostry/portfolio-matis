import { createHmac, randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { sessions } from '../db/schema.ts';

export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

// Seule une empreinte du jeton est conservée : lire la base ne permet pas d'ouvrir une session.
// Elle dépend du hash du mot de passe : en changer ferme donc toutes les sessions ouvertes.
const fingerprint = (token: string, passwordHash: string): string =>
  createHmac('sha256', passwordHash).update(token).digest('hex');

export const createSession = (db: Db, passwordHash: string): string => {
  const now = Date.now();
  db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
  const token = randomBytes(32).toString('base64url');
  db.insert(sessions).values({ tokenHash: fingerprint(token, passwordHash), expiresAt: now + SESSION_DURATION_SECONDS * 1000 }).run();
  return token;
};

export const isSessionValid = (db: Db, token: string, passwordHash: string): boolean => {
  const row = db.select().from(sessions).where(eq(sessions.tokenHash, fingerprint(token, passwordHash))).get();
  return row !== undefined && row.expiresAt > Date.now();
};

export const deleteSession = (db: Db, token: string, passwordHash: string): void => {
  db.delete(sessions).where(eq(sessions.tokenHash, fingerprint(token, passwordHash))).run();
};
