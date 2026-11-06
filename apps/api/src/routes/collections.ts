import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createInput,
  draftStateSchema,
  educationSchema,
  experienceSchema,
  PROJECT_CATEGORY_IDS,
  projectCategorySchema,
  projectSchema,
  skillCategorySchema,
  updateInput,
} from '@portfolio-matis/content';
import type { CollectionName } from '../db/draft-repo.ts';

const NOT_FOUND = { message: 'Élément introuvable' };

type CollectionOptions = {
  path: string;
  collection: Exclude<CollectionName, 'projectCategories'>;
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

  app.get(url, { schema: { tags, security, summary: 'Liste, dans l’ordre', response: { 200: z.array(schema) } } }, async () =>
    repo.list(collection),
  );

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

const registerProjectCategories = (base: FastifyInstance): void => {
  const app = base.withTypeProvider<ZodTypeProvider>();
  const tags = ['Catégories de projets'];
  const security = [{ session: [] }];

  app.get('/project-categories', { schema: { tags, security, summary: 'Liste les trois catégories', response: { 200: z.array(projectCategorySchema) } } }, async () =>
    base.repo.list('projectCategories'),
  );

  app.put(
    '/project-categories/:id',
    {
      schema: {
        tags,
        security,
        summary: 'Remplit une des trois catégories, dont les identifiants sont fixes',
        params: z.object({ id: z.enum(PROJECT_CATEGORY_IDS) }),
        body: updateInput(projectCategorySchema),
      },
    },
    async (request) => {
      const { id } = request.params;
      const category = { ...request.body, id, position: PROJECT_CATEGORY_IDS.indexOf(id) };
      base.repo.putProjectCategory(category);
      return category;
    },
  );
};

export const collectionRoutes = async (base: FastifyInstance): Promise<void> => {
  registerCollection(base, { path: 'experiences', collection: 'experiences', schema: experienceSchema, tag: 'Expériences' });
  registerCollection(base, { path: 'educations', collection: 'educations', schema: educationSchema, tag: 'Formations' });
  registerCollection(base, { path: 'projects', collection: 'projects', schema: projectSchema, tag: 'Projets' });
  registerCollection(base, { path: 'skill-categories', collection: 'skillCategories', schema: skillCategorySchema, tag: 'Compétences' });
  registerProjectCategories(base);

  base.withTypeProvider<ZodTypeProvider>().get(
    '/draft',
    { schema: { tags: ['Brouillon'], security: [{ session: [] }], summary: 'Tout le brouillon, pour l’aperçu', response: { 200: draftStateSchema } } },
    async () => base.repo.readState(),
  );
};
