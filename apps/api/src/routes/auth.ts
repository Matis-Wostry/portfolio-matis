import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { verifyPassword } from '../auth/password.ts';
import { createSession, deleteSession, isSessionValid, SESSION_DURATION_SECONDS } from '../auth/sessions.ts';

const COOKIE_NAME = 'session';

const readSessionToken = (request: FastifyRequest): string | null => {
  const raw = request.cookies[COOKIE_NAME];
  if (!raw) return null;
  const unsigned = request.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
};

declare module 'fastify' {
  interface FastifyInstance {
    requireSession: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  }
}

/** À poser sur chaque route protégée, avant toute lecture du corps. */
export const registerSessionGuard = (app: FastifyInstance): void => {
  app.decorate('requireSession', async (request, reply) => {
    const token = readSessionToken(request);
    if (!token || !isSessionValid(app.db, token, app.config.adminPasswordHash)) {
      return reply.code(401).send({ message: 'Session expirée : reconnectez-vous' });
    }
    return undefined;
  });
};

export const authRoutes = async (base: FastifyInstance): Promise<void> => {
  const app = base.withTypeProvider<ZodTypeProvider>();

  app.post(
    '/auth/login',
    {
      schema: { tags: ['Connexion'], summary: 'Ouvre une session', body: z.object({ password: z.string().min(1) }) },
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'Trop de tentatives : réessayez dans quelques minutes',
          }),
        },
      },
    },
    async (request, reply) => {
      if (!(await verifyPassword(request.body.password, app.config.adminPasswordHash))) {
        return reply.code(401).send({ message: 'Mot de passe incorrect' });
      }
      return reply
        .setCookie(COOKIE_NAME, createSession(app.db, app.config.adminPasswordHash), {
          signed: true,
          httpOnly: true,
          secure: app.config.cookieSecure,
          sameSite: 'strict',
          path: '/',
          maxAge: SESSION_DURATION_SECONDS,
        })
        .send({ ok: true });
    },
  );

  app.post(
    '/auth/logout',
    { onRequest: app.requireSession, schema: { tags: ['Connexion'], summary: 'Ferme la session' } },
    async (request, reply) => {
      const token = readSessionToken(request);
      if (token) deleteSession(app.db, token, app.config.adminPasswordHash);
      return reply.clearCookie(COOKIE_NAME, { path: '/' }).send({ ok: true });
    },
  );

  app.get(
    '/auth/me',
    { onRequest: app.requireSession, schema: { tags: ['Connexion'], summary: 'Indique si la session est valide' } },
    async () => ({ authenticated: true }),
  );
};
