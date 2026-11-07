import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import type { AppConfig } from './config.ts';
import { openDatabase, type Db } from './db/client.ts';
import { createDraftRepo, type DraftRepo } from './db/draft-repo.ts';
import { createGithubDispatcher, type Dispatcher } from './deploy/dispatcher.ts';
import { authRoutes, registerSessionGuard } from './routes/auth.ts';
import { collectionRoutes } from './routes/collections.ts';
import { mediaRoutes } from './routes/media.ts';
import { publicRoutes } from './routes/public.ts';
import { publishRoutes } from './routes/publish.ts';
import { singletonRoutes } from './routes/singletons.ts';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    db: Db;
    repo: DraftRepo;
    dispatcher: Dispatcher | null;
    writeRoutes: { method: string; url: string }[];
    adminReadRoutes: string[];
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Les erreurs que Fastify et ses extensions renvoient en anglais.
const FRENCH_MESSAGES: Record<string, string> = {
  FST_ERR_CTP_INVALID_JSON_BODY: 'Le corps de la requête n’est pas un JSON valide',
  FST_ERR_CTP_EMPTY_JSON_BODY: 'Le corps de la requête est vide',
  FST_INVALID_MULTIPART_CONTENT_TYPE: 'La requête doit contenir un fichier',
};

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
    return reply.code(status).send({ message: FRENCH_MESSAGES[error.code] ?? error.message });
  });
};

export type AppDeps = { dispatcher?: Dispatcher };

export const buildApp = async (config: AppConfig, deps: AppDeps = {}): Promise<FastifyInstance> => {
  const dispatcher =
    deps.dispatcher ?? (config.githubDispatchToken ? createGithubDispatcher(config.githubDispatchToken) : null);
  if (config.deploySites.length > 0 && !dispatcher) {
    throw new Error('Configuration invalide : GITHUB_DISPATCH_TOKEN est obligatoire quand DEPLOY_SITES contient des sites');
  }

  const app = Fastify({
    logger: process.env.NODE_ENV === 'production',
    // Seul Caddy est de confiance : l'adresse du visiteur est la dernière qu'il ajoute à X-Forwarded-For.
    trustProxy: (_address: string, hop: number) => hop < 1,
  });
  const db = openDatabase(config.databasePath);

  app.decorate('config', config);
  app.decorate('db', db);
  app.decorate('repo', createDraftRepo(db));
  app.decorate('dispatcher', dispatcher);
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
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'API Portfolio Matis',
        version: '0.1.0',
        description: 'Source unique du contenu de mes deux sites : brouillon, médias, publication et lecture publique.',
      },
      components: { securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'session' } } },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  registerSessionGuard(app);
  await app.register(authRoutes);

  // Tout ce qui est sous /admin passe par ce contrôle : une nouvelle route ne peut pas l'oublier.
  await app.register(
    async (admin) => {
      admin.addHook('onRequest', app.requireSession);
      await admin.register(collectionRoutes);
      await admin.register(singletonRoutes);
      await admin.register(mediaRoutes);
      await admin.register(publishRoutes);
    },
    { prefix: '/admin' },
  );

  await app.register(publicRoutes);

  app.get('/health', { schema: { tags: ['Santé'], summary: 'Indique que le service répond' } }, async () => ({ ok: true }));

  return app;
};
