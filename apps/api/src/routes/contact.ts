import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Mailer } from '../contact/mailer.ts';

export const CONTACT_URL = '/public/contact';

const oneLine = z.string().trim().min(1, 'Ce champ est obligatoire').regex(/^[^\r\n]*$/, 'Une seule ligne');

const contactBody = z.object({
  name: oneLine.max(100, '100 caractères au plus'),
  email: z.email('Adresse email invalide').max(200),
  message: z.string().trim().min(1, 'Ce champ est obligatoire').max(5000, '5000 caractères au plus'),
  // Champ caché du formulaire : un visiteur le laisse vide, un robot le remplit.
  website: z.string().optional(),
});

const messageResponse = z.object({ message: z.string() });

/**
 * Le formulaire de contact du site : le message part par mail chez Matis, et rien n'est gardé en base.
 * Seules les origines du site peuvent l'appeler, sans session, et chaque adresse est limitée à 5 envois par heure.
 */
export const contactRoutes = async (base: FastifyInstance, { mailer }: { mailer: Mailer | null }): Promise<void> => {
  const app = base.withTypeProvider<ZodTypeProvider>();

  app.post(
    CONTACT_URL,
    {
      schema: {
        tags: ['Contact'],
        summary: 'Envoie le message du formulaire du site par mail',
        body: contactBody,
        response: { 200: messageResponse, 502: messageResponse, 503: messageResponse },
      },
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 hour',
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'Trop de messages envoyés : réessayez plus tard',
          }),
        },
      },
    },
    async (request, reply) => {
      if (!mailer) return reply.code(503).send({ message: 'Le formulaire est indisponible pour le moment' });
      const { name, email, message, website } = request.body;
      // Le robot reçoit la même réponse qu'un visiteur : rien ne lui indique que son message est écarté.
      if (website) return { message: 'Message envoyé' };
      try {
        await mailer.send({
          replyTo: email,
          subject: `Portfolio : message de ${name}`,
          text: `Message envoyé depuis le formulaire du site.\n\nNom : ${name}\nEmail : ${email}\n\n${message}\n`,
        });
      } catch (error) {
        request.log.error(error, 'Envoi du formulaire de contact impossible');
        return reply.code(502).send({ message: 'Le message n’a pas pu être envoyé : réessayez plus tard' });
      }
      return { message: 'Message envoyé' };
    },
  );
};
