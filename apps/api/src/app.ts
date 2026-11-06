import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import type { AppConfig } from './config.ts';
import { openDatabase, type Db } from './db/client.ts';
import { createDraftRepo, type DraftRepo } from './db/draft-repo.ts';
import { authRoutes, registerSessionGuard } from './routes/auth.ts';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    db: Db;
    repo: DraftRepo;
    writeRoutes: { method: string; url: string }[];
    adminReadRoutes: string[];
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const registerErrorHandler = (app: FastifyInstance): void => {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const issues = error.validation.map((issue) => ({
        path: issue.instancePath.replace(/^\//, '').replaceAll('/', '.'),
        message: issue.message ?? 'Valeur invalide',
      }));
      return reply.code(400).send({ message: 'Certains champs sont invalides', issues });
    }
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      request.log.error(error);
      return reply.code(status).send({ message: 'Erreur interne du serveur' });
    }
    return reply.code(status).send({ message: error.message });
  });
};

export const buildApp = async (config: AppConfig): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'production',
    // Seul Caddy est de confiance : l'adresse du visiteur est la dernière qu'il ajoute à X-Forwarded-For.
    trustProxy: (_address: string, hop: number) => hop < 1,
  });
  const db = openDatabase(config.databasePath);

  app.decorate('config', config);
  app.decorate('db', db);
  app.decorate('repo', createDraftRepo(db));
  app.decorate('writeRoutes', []);
  app.decorate('adminReadRoutes', []);
  app.addHook('onClose', async () => db.$client.close());

  app.addHook('onRoute', ({ method, url }) => {
    for (const verb of [method].flat()) {
      if (!SAFE_METHODS.has(verb)) app.writeRoutes.push({ method: verb, url });
      if (verb === 'GET' && url.startsWith('/admin')) app.adminReadRoutes.push(url);
    }
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  // Vérifiée avant tout le reste : une écriture ne peut venir que de l'interface.
  app.addHook('onRequest', async (request, reply) => {
    if (!SAFE_METHODS.has(request.method) && request.headers.origin !== config.adminOrigin) {
      return reply.code(403).send({ message: 'Origine refusée' });
    }
    return undefined;
  });

  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(cors, {
    origin: [config.adminOrigin],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });
  await app.register(rateLimit, { global: false });

  registerSessionGuard(app);
  await app.register(authRoutes);

  app.get('/health', { schema: { tags: ['Santé'], summary: 'Indique que le service répond' } }, async () => ({ ok: true }));

  return app;
};
