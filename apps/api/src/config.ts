import { z } from 'zod';

export type DeploySite = { name: string; repo: string; workflow: string; ref: string };

export type AppConfig = {
  databasePath: string;
  mediaDir: string;
  adminPasswordHash: string;
  sessionSecret: string;
  adminOrigin: string;
  cookieSecure: boolean;
  deploySites: DeploySite[];
  githubDispatchToken?: string;
  port: number;
};

const deploySitesSchema = z.array(
  z.object({
    name: z.string().min(1),
    repo: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
    workflow: z.string().min(1),
    ref: z.string().min(1),
  }),
);

const parseDeploySites = (raw: string, ctx: z.RefinementCtx): DeploySite[] => {
  try {
    return deploySitesSchema.parse(JSON.parse(raw));
  } catch {
    ctx.addIssue({ code: 'custom', message: 'doit être une liste JSON de sites { name, repo, workflow, ref }' });
    return z.NEVER;
  }
};

const envSchema = z.object({
  DATABASE_PATH: z.string().min(1).default('data/data.db'),
  MEDIA_DIR: z.string().min(1).default('data/media'),
  ADMIN_PASSWORD_HASH: z.string({ error: 'obligatoire' }).min(1),
  SESSION_SECRET: z.string({ error: 'obligatoire' }).min(32, 'doit faire au moins 32 caractères'),
  ADMIN_ORIGIN: z.url({ error: 'doit être une adresse complète' }),
  COOKIE_SECURE: z.string().optional(),
  DEPLOY_SITES: z.string().default('[]').transform(parseDeploySites),
  GITHUB_DISPATCH_TOKEN: z.string().min(1).optional(),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
});

/** Lit la configuration ; sans ses secrets, le serveur refuse de démarrer plutôt que d'utiliser une valeur par défaut. */
export const loadConfig = (env: Record<string, string | undefined> = process.env): AppConfig => {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')} : ${issue.message}`).join(' ; ');
    throw new Error(`Configuration invalide : ${details}`);
  }
  const { data } = parsed;
  return {
    databasePath: data.DATABASE_PATH,
    mediaDir: data.MEDIA_DIR,
    adminPasswordHash: data.ADMIN_PASSWORD_HASH,
    sessionSecret: data.SESSION_SECRET,
    adminOrigin: data.ADMIN_ORIGIN,
    cookieSecure: data.COOKIE_SECURE !== 'false',
    deploySites: data.DEPLOY_SITES,
    ...(data.GITHUB_DISPATCH_TOKEN ? { githubDispatchToken: data.GITHUB_DISPATCH_TOKEN } : {}),
    port: data.PORT,
  };
};
