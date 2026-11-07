import { z } from 'zod';
import { PASSWORD_HASH_PATTERN } from './auth/password.ts';

export type DeploySite = { name: string; repo: string; workflow: string; ref: string };

export type ContactConfig = {
  /** Les adresses du site, seules autorisées à envoyer le formulaire. */
  origins: string[];
  to: string;
  from: string;
  smtp: { host: string; port: number; secure: boolean; user: string; password: string };
};

export type AppConfig = {
  databasePath: string;
  mediaDir: string;
  adminPasswordHash: string;
  sessionSecret: string;
  adminOrigin: string;
  cookieSecure: boolean;
  deploySites: DeploySite[];
  githubDispatchToken?: string;
  /** Absent : le formulaire de contact répond qu'il est indisponible. */
  contact?: ContactConfig;
  port: number;
};

const CONTACT_KEYS = ['CONTACT_ORIGINS', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'] as const;

const toOrigin = (value: string): string => new URL(value).origin;

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
  ADMIN_PASSWORD_HASH: z
    .string({ error: 'obligatoire' })
    .regex(PASSWORD_HASH_PATTERN, 'doit être la ligne complète affichée par hash-password, qui commence par « scrypt: »'),
  SESSION_SECRET: z.string({ error: 'obligatoire' }).min(32, 'doit faire au moins 32 caractères'),
  // Ramenée à ce que le navigateur envoie dans l'en-tête Origin : sans barre finale ni chemin.
  ADMIN_ORIGIN: z.url({ error: 'doit être une adresse complète' }).transform((url) => new URL(url).origin),
  COOKIE_SECURE: z.string().optional(),
  DEPLOY_SITES: z.string().default('[]').transform(parseDeploySites),
  GITHUB_DISPATCH_TOKEN: z.string().min(1).optional(),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  // Formulaire de contact : tout ou rien. Origines séparées par des virgules, ramenées à ce que le navigateur envoie.
  CONTACT_ORIGINS: z
    .string()
    .transform((raw) => raw.split(',').map((part) => part.trim()).filter(Boolean))
    .pipe(z.array(z.url({ error: 'doit être une liste d’adresses complètes, séparées par des virgules' }).transform(toOrigin)).min(1))
    .optional(),
  CONTACT_TO: z.email().optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
});

type Env = z.infer<typeof envSchema>;

/** Le formulaire n'est actif que si tout son réglage est là ; un réglage à moitié fait empêche le démarrage. */
const readContact = (data: Env): ContactConfig | undefined => {
  const missing = CONTACT_KEYS.filter((key) => !data[key]);
  if (missing.length === CONTACT_KEYS.length) return undefined;
  if (missing.length > 0) {
    throw new Error(`Configuration invalide : le formulaire de contact demande aussi ${missing.join(', ')}`);
  }
  const user = data.SMTP_USER as string;
  return {
    origins: data.CONTACT_ORIGINS as string[],
    to: data.CONTACT_TO ?? user,
    from: user,
    // 465 : connexion chiffrée d'emblée ; sur les autres ports, STARTTLS.
    smtp: { host: data.SMTP_HOST as string, port: data.SMTP_PORT, secure: data.SMTP_PORT === 465, user, password: data.SMTP_PASSWORD as string },
  };
};

/** Lit la configuration ; sans ses secrets, le serveur refuse de démarrer plutôt que d'utiliser une valeur par défaut. */
export const loadConfig = (env: Record<string, string | undefined> = process.env): AppConfig => {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')} : ${issue.message}`).join(' ; ');
    throw new Error(`Configuration invalide : ${details}`);
  }
  const { data } = parsed;
  if (data.DEPLOY_SITES.length > 0 && !data.GITHUB_DISPATCH_TOKEN) {
    throw new Error('Configuration invalide : GITHUB_DISPATCH_TOKEN est obligatoire quand DEPLOY_SITES contient des sites');
  }
  const contact = readContact(data);
  return {
    databasePath: data.DATABASE_PATH,
    mediaDir: data.MEDIA_DIR,
    adminPasswordHash: data.ADMIN_PASSWORD_HASH,
    sessionSecret: data.SESSION_SECRET,
    adminOrigin: data.ADMIN_ORIGIN,
    cookieSecure: data.COOKIE_SECURE !== 'false',
    deploySites: data.DEPLOY_SITES,
    ...(data.GITHUB_DISPATCH_TOKEN ? { githubDispatchToken: data.GITHUB_DISPATCH_TOKEN } : {}),
    ...(contact ? { contact } : {}),
    port: data.PORT,
  };
};
