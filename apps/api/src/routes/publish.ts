import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  canonicalContent,
  collectMediaFiles,
  draftContentSchema,
  findPublishIssues,
  type DraftState,
  type PublishIssue,
} from '@portfolio-matis/content';
import type { DeploySite } from '../config.ts';
import { deploys, media } from '../db/schema.ts';
import { insertSnapshot, latestSnapshot } from '../db/snapshots.ts';
import type { RunStatus } from '../deploy/dispatcher.ts';

const findMissingMedia = (app: FastifyInstance, state: DraftState): PublishIssue[] =>
  collectMediaFiles(state)
    .filter((file) => {
      const known = app.db.select().from(media).where(eq(media.file, file)).get();
      return !known || !existsSync(join(app.config.mediaDir, file));
    })
    .map((file) => ({ path: `media.${file}`, message: `Le fichier « ${file} » est introuvable` }));

const dispatchSite = async (app: FastifyInstance, site: DeploySite): Promise<string | null> => {
  try {
    if (!app.dispatcher) throw new Error('Aucun déclencheur configuré');
    await app.dispatcher.dispatch(site);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Déclenchement impossible';
  }
};

export const publishRoutes = async (app: FastifyInstance): Promise<void> => {
  const tags = ['Publication'];
  const security = [{ session: [] }];

  app.post(
    '/publish',
    { schema: { tags, security, summary: 'Fige tout le brouillon puis déclenche le déploiement des sites' } },
    async (_request, reply) => {
      const state = app.repo.readState();
      const issues = [...findPublishIssues(state), ...findMissingMedia(app, state)];
      const parsed = draftContentSchema.safeParse(state);
      if (issues.length === 0 && !parsed.success) {
        issues.push(...parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })));
      }
      if (issues.length > 0 || !parsed.success) {
        return reply.code(409).send({ message: 'Le contenu n’est pas prêt à être publié', issues });
      }

      const publishedAt = new Date().toISOString();
      const snapshot = insertSnapshot(app.db, parsed.data, publishedAt);

      // Un échec de déclenchement ne défait pas la publication : il se voit et se relance en republiant.
      const results = await Promise.all(
        app.config.deploySites.map(async (site) => ({ site: site.name, error: await dispatchSite(app, site) })),
      );
      for (const result of results) {
        app.db.insert(deploys).values({ snapshotId: snapshot.id, dispatchedAt: publishedAt, ...result }).run();
      }
      return { snapshotId: snapshot.id, deploys: results };
    },
  );

  app.get(
    '/status',
    { schema: { tags, security, summary: 'Brouillon à publier, et état du dernier déploiement de chaque site' } },
    async () => {
      const latest = latestSnapshot(app.db);
      const rows = latest ? app.db.select().from(deploys).where(eq(deploys.snapshotId, latest.id)).all() : [];

      const statuses = await Promise.all(
        rows.map(async ({ site: name, dispatchedAt, error }) => {
          const site = app.config.deploySites.find((candidate) => candidate.name === name);
          let run: RunStatus = { state: 'unknown', url: null };
          if (error) run = { state: 'failure', url: null };
          else if (site && app.dispatcher) run = await app.dispatcher.latestRun(site, dispatchedAt);
          return { site: name, ...run, error };
        }),
      );

      return {
        hasUnpublishedChanges: !latest || canonicalContent(app.repo.readState()) !== canonicalContent(latest.content),
        lastPublishedAt: latest?.publishedAt ?? null,
        deploys: statuses,
      };
    },
  );
};
