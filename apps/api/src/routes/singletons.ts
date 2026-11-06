import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contactSchema, profileSchema } from '@portfolio-matis/content';

export const singletonRoutes = async (base: FastifyInstance): Promise<void> => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { repo } = base;
  const security = [{ session: [] }];

  app.get('/profile', { schema: { tags: ['Présentation'], security, summary: 'Lit la présentation' } }, async (_request, reply) =>
    repo.getProfile() ?? reply.code(404).send({ message: 'La présentation n’est pas encore remplie' }),
  );

  app.put('/profile', { schema: { tags: ['Présentation'], security, summary: 'Remplace la présentation', body: profileSchema } }, async (request) => {
    repo.putProfile(request.body);
    return request.body;
  });

  app.get('/contact', { schema: { tags: ['Contact'], security, summary: 'Lit le contact' } }, async (_request, reply) =>
    repo.getContact() ?? reply.code(404).send({ message: 'Le contact n’est pas encore rempli' }),
  );

  app.put('/contact', { schema: { tags: ['Contact'], security, summary: 'Remplace le contact', body: contactSchema } }, async (request) => {
    repo.putContact(request.body);
    return request.body;
  });
};
