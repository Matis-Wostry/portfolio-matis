import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, test } from 'vitest';
import { buildApp } from '../src/app.ts';
import type { ContactMail, Mailer } from '../src/contact/mailer.ts';
import { ADMIN_ORIGIN, testConfig } from './helpers.ts';

const SITE_ORIGIN = 'https://site.example.test';
const CONTACT = {
  origins: [SITE_ORIGIN],
  to: 'matis@example.test',
  from: 'envoi@example.test',
  smtp: { host: 'smtp.example.test', port: 465, secure: true, user: 'envoi@example.test', password: 'secret' },
};
const MESSAGE = { name: 'Alice Martin', email: 'alice@example.test', message: 'Bonjour, votre profil nous intéresse.' };

let app: FastifyInstance;
let sent: ContactMail[];

const start = async (options: { mailer?: Mailer; contact?: boolean } = {}) => {
  sent = [];
  const mailer: Mailer = options.mailer ?? { send: async (mail) => void sent.push(mail) };
  app = await buildApp(testConfig(options.contact === false ? {} : { contact: CONTACT }), { mailer });
  return app;
};

const post = (payload: object, origin = SITE_ORIGIN, ip = '203.0.113.1') =>
  app.inject({ method: 'POST', url: '/public/contact', headers: { origin }, remoteAddress: ip, payload });

afterEach(() => app?.close());

describe('formulaire de contact', () => {
  test('un message valide est envoyé par mail, avec l’adresse du visiteur en réponse', async () => {
    await start();
    const response = await post(MESSAGE);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Message envoyé' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ replyTo: 'alice@example.test', subject: 'Portfolio : message de Alice Martin' });
    expect(sent[0]?.text).toContain('Alice Martin');
    expect(sent[0]?.text).toContain('alice@example.test');
    expect(sent[0]?.text).toContain('Bonjour, votre profil nous intéresse.');
  });

  test('une autre origine que le site est refusée, sans envoi', async () => {
    await start();
    expect((await post(MESSAGE, 'https://autre.example.test')).statusCode).toBe(403);
    expect((await post(MESSAGE, ADMIN_ORIGIN)).statusCode).toBe(403);
    expect(sent).toHaveLength(0);
  });

  test('un robot qui remplit le champ caché reçoit une réponse normale, mais rien n’est envoyé', async () => {
    await start();
    const response = await post({ ...MESSAGE, website: 'https://spam.example' });
    expect(response.statusCode).toBe(200);
    expect(sent).toHaveLength(0);
  });

  test.each([
    ['un email invalide', { email: 'pas-un-email' }, 'email'],
    ['un nom vide', { name: '   ' }, 'name'],
    ['un nom sur deux lignes', { name: 'Alice\nBcc: autre@example.test' }, 'name'],
    ['un message vide', { message: '' }, 'message'],
    ['un message trop long', { message: 'x'.repeat(5001) }, 'message'],
  ])('%s est refusé avec le champ en cause', async (_label, change, field) => {
    await start();
    const response = await post({ ...MESSAGE, ...change });
    expect(response.statusCode).toBe(400);
    expect(response.json().issues.map((issue: { path: string }) => issue.path)).toContain(field);
    expect(sent).toHaveLength(0);
  });

  test('au-delà de 5 messages par heure depuis la même adresse, l’envoi est refusé en français', async () => {
    await start();
    for (let i = 0; i < 5; i += 1) expect((await post(MESSAGE)).statusCode).toBe(200);
    const refused = await post(MESSAGE);
    expect(refused.statusCode).toBe(429);
    expect(refused.json().message).toBe('Trop de messages envoyés : réessayez plus tard');
    expect((await post(MESSAGE, SITE_ORIGIN, '203.0.113.2')).statusCode).toBe(200);
  });

  test('un échec du serveur de mail est signalé, sans détail technique', async () => {
    await start({ mailer: { send: async () => Promise.reject(new Error('535 authentication failed')) } });
    const response = await post(MESSAGE);
    expect(response.statusCode).toBe(502);
    expect(response.json().message).toBe('Le message n’a pas pu être envoyé : réessayez plus tard');
    expect(response.body).not.toContain('535');
  });

  test('sans configuration du mail, le formulaire répond qu’il est indisponible', async () => {
    await start({ contact: false });
    const response = await post(MESSAGE);
    expect(response.statusCode).toBe(503);
    expect(response.json().message).toBe('Le formulaire est indisponible pour le moment');
  });
});

describe('accès depuis le site', () => {
  const preflight = (url: string, origin = SITE_ORIGIN) =>
    app.inject({ method: 'OPTIONS', url, headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });

  test('le site peut envoyer au formulaire, sans cookie', async () => {
    await start();
    const response = await preflight('/public/contact');
    expect(response.headers['access-control-allow-origin']).toBe(SITE_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  test('le site n’a pas accès aux routes de l’administration', async () => {
    await start();
    const response = await preflight('/admin/projects');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('l’interface garde son accès avec cookie', async () => {
    await start();
    const response = await preflight('/admin/projects', ADMIN_ORIGIN);
    expect(response.headers['access-control-allow-origin']).toBe(ADMIN_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
