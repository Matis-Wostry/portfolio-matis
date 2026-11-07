import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import multipart from '@fastify/multipart';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { fileTypeFromBuffer } from 'file-type';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { collectMediaFiles, mediaFileNameSchema } from '@portfolio-matis/content';
import { media } from '../db/schema.ts';
import { latestSnapshot } from '../db/snapshots.ts';

const MEGABYTE = 1024 * 1024;
const IMAGE_MAX_BYTES = 5 * MEGABYTE;
const PDF_MAX_BYTES = 10 * MEGABYTE;

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const TOO_LARGE = { message: 'Fichier trop lourd : 5 Mo au plus pour une image, 10 Mo pour un PDF' };
const WRONG_TYPE = { message: 'Type de fichier refusé : PNG, JPEG, WebP ou PDF seulement' };

export const mediaFileParams = z.object({ file: mediaFileNameSchema });

/** Envoie un média connu de la base ; le nom a déjà été validé par `mediaFileParams`. */
export const sendMedia = async (app: FastifyInstance, reply: FastifyReply, file: string): Promise<FastifyReply> => {
  const row = app.db.select().from(media).where(eq(media.file, file)).get();
  if (!row) return reply.code(404).send({ message: 'Média introuvable' });

  let content: Buffer;
  try {
    content = await readFile(join(app.config.mediaDir, file));
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') throw error;
    return reply.code(404).send({ message: `Le fichier « ${file} » a disparu du serveur` });
  }
  return reply.header('Content-Type', row.mime).header('X-Content-Type-Options', 'nosniff').send(content);
};

const isTooLarge = (error: unknown): boolean => (error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE';

export const mediaRoutes = async (base: FastifyInstance): Promise<void> => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const tags = ['Médias'];
  const security = [{ session: [] }];
  const { mediaDir } = base.config;

  await mkdir(mediaDir, { recursive: true });
  await base.register(multipart);

  app.post(
    '/media',
    { schema: { tags, security, summary: 'Envoie une image ou un PDF', consumes: ['multipart/form-data'] } },
    async (request, reply) => {
      const part = await request.file({ limits: { fileSize: PDF_MAX_BYTES, files: 1 } });
      if (!part) return reply.code(400).send({ message: 'Aucun fichier reçu' });

      let content: Buffer;
      try {
        content = await part.toBuffer();
      } catch (error) {
        if (isTooLarge(error)) return reply.code(413).send(TOO_LARGE);
        throw error;
      }

      const mime = (await fileTypeFromBuffer(content))?.mime;
      const extension = mime ? EXTENSIONS[mime] : undefined;
      if (!mime || !extension) return reply.code(415).send(WRONG_TYPE);
      if (mime !== 'application/pdf' && content.length > IMAGE_MAX_BYTES) return reply.code(413).send(TOO_LARGE);

      // Le nom sur le disque est généré : celui du visiteur ne sert qu'à l'affichage.
      const row = {
        file: `${randomUUID()}.${extension}`,
        originalName: part.filename,
        mime,
        size: content.length,
        createdAt: new Date().toISOString(),
      };
      await writeFile(join(mediaDir, row.file), content);
      try {
        base.db.insert(media).values(row).run();
      } catch (error) {
        // Un fichier sans ligne en base serait invisible et jamais supprimé.
        await rm(join(mediaDir, row.file), { force: true });
        throw error;
      }
      return reply.code(201).send(row);
    },
  );

  app.get('/media', { schema: { tags, security, summary: 'Liste les médias envoyés' } }, async () =>
    base.db.select().from(media).orderBy(asc(media.createdAt)).all(),
  );

  app.get('/media/:file', { schema: { tags, security, summary: 'Lit un média, même non publié', params: mediaFileParams } }, async (request, reply) =>
    sendMedia(base, reply, request.params.file),
  );

  app.delete(
    '/media/:file',
    { schema: { tags, security, summary: 'Supprime un média qui n’est plus utilisé', params: mediaFileParams } },
    async (request, reply) => {
      const { file } = request.params;
      if (!base.db.select().from(media).where(eq(media.file, file)).get()) {
        return reply.code(404).send({ message: 'Média introuvable' });
      }

      const published = latestSnapshot(base.db)?.content;
      const used = new Set([...collectMediaFiles(base.repo.readState()), ...(published ? collectMediaFiles(published) : [])]);
      if (used.has(file)) {
        return reply.code(409).send({ message: 'Ce média est encore utilisé par le brouillon ou par la dernière publication' });
      }

      // Le fichier d'abord : si sa suppression échoue, la ligne reste et le média reste visible.
      await rm(join(mediaDir, file), { force: true });
      base.db.delete(media).where(eq(media.file, file)).run();
      return reply.code(204).send();
    },
  );
};
