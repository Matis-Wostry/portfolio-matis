import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createInput,
  educationSchema,
  experienceSchema,
  projectCategorySchema,
  projectSchema,
  skillCategorySchema,
  updateInput,
} from '@portfolio-matis/content';
import type { CollectionName } from '../db/draft-repo.ts';

const NOT_FOUND = { message: 'Élément introuvable' };

type CollectionOptions = {
  path: string;
  collection: CollectionName;
  schema: z.ZodObject;
  tag: string;
};

const registerCollection = (base: FastifyInstance, { path, collection, schema, tag }: CollectionOptions): void => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const { repo } = base;
  const url = `/${path}`;
  const params = z.object({ id: z.string() });
  const tags = [tag];
  const security = [{ session: [] }];

  // Les lectures ne valident pas leur réponse : un contenu devenu non conforme doit rester lisible pour être corrigé.
  app.get(url, { schema: { tags, security, summary: 'Liste, dans l’ordre' } }, async () => repo.list(collection));

  app.post(
    url,
    { schema: { tags, security, summary: 'Crée un élément, placé en dernier', body: createInput(schema), response: { 201: schema } } },
    async (request, reply) => reply.code(201).send(repo.create(collection, request.body as never)),
  );

  app.post(
    `${url}/reorder`,
    { schema: { tags, security, summary: 'Change l’ordre : tous les identifiants, une fois chacun', body: z.object({ ids: z.array(z.string()) }) } },
    async (request, reply) => {
      repo.reorder(collection, request.body.ids);
      return reply.code(204).send();
    },
  );

  app.get(`${url}/:id`, { schema: { tags, security, summary: 'Lit un élément', params } }, async (request, reply) => {
    const row = repo.get(collection, request.params.id);
    return row ?? reply.code(404).send(NOT_FOUND);
  });

  app.put(
    `${url}/:id`,
    { schema: { tags, security, summary: 'Modifie un élément ; son identifiant ne change jamais', params, body: updateInput(schema) } },
    async (request, reply) => {
      const row = repo.update(collection, request.params.id, request.body as never);
      return row ?? reply.code(404).send(NOT_FOUND);
    },
  );

  app.delete(`${url}/:id`, { schema: { tags, security, summary: 'Supprime un élément', params } }, async (request, reply) => {
    if (!repo.remove(collection, request.params.id)) return reply.code(404).send(NOT_FOUND);
    return reply.code(204).send();
  });
};

export const collectionRoutes = async (base: FastifyInstance): Promise<void> => {
  registerCollection(base, { path: 'experiences', collection: 'experiences', schema: experienceSchema, tag: 'Expériences' });
  registerCollection(base, { path: 'educations', collection: 'educations', schema: educationSchema, tag: 'Formations' });
  registerCollection(base, { path: 'projects', collection: 'projects', schema: projectSchema, tag: 'Projets' });
  registerCollection(base, { path: 'skill-categories', collection: 'skillCategories', schema: skillCategorySchema, tag: 'Compétences' });
  // Une catégorie qui contient encore des projets ne se supprime pas : 409, avec leur nombre.
  registerCollection(base, { path: 'project-categories', collection: 'projectCategories', schema: projectCategorySchema, tag: 'Catégories de projets' });

  base.withTypeProvider<ZodTypeProvider>().get(
    '/draft',
    { schema: { tags: ['Brouillon'], security: [{ session: [] }], summary: 'Tout le brouillon, pour l’aperçu' } },
    async () => base.repo.readState(),
  );
};
