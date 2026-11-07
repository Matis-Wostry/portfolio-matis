import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { collectMediaFiles, publicSnapshotSchema, toPublicSnapshot, type PublicSnapshot } from '@portfolio-matis/content';
import { latestSnapshot } from '../db/snapshots.ts';
import { mediaFileParams, sendMedia } from './media.ts';

const currentPublicSnapshot = (app: FastifyInstance): PublicSnapshot | null => {
  const latest = latestSnapshot(app.db);
  return latest ? toPublicSnapshot(latest.content, latest.publishedAt) : null;
};

export const publicRoutes = async (base: FastifyInstance): Promise<void> => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const tags = ['Lecture publique'];

  app.get(
    '/public/snapshot',
    {
      schema: {
        tags,
        summary: 'Dernier contenu publié, sans brouillon ni projet masqué',
        response: { 200: publicSnapshotSchema, 404: z.object({ message: z.string() }) },
      },
    },
    async (_request, reply) => {
      const snapshot = currentPublicSnapshot(base);
      return snapshot ? reply.send(snapshot) : reply.code(404).send({ message: 'Rien n’a encore été publié' });
    },
  );

  app.get(
    '/public/media/:file',
    { schema: { tags, summary: 'Média utilisé par le dernier contenu publié', params: mediaFileParams } },
    async (request, reply) => {
      const snapshot = currentPublicSnapshot(base);
      const { file } = request.params;
      if (!snapshot || !collectMediaFiles(snapshot.content).includes(file)) {
        return reply.code(404).send({ message: 'Média introuvable' });
      }
      return sendMedia(base, reply, file);
    },
  );
};
