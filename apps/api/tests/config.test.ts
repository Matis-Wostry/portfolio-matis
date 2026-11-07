import { describe, expect, test } from 'vitest';
import { loadConfig } from '../src/config.ts';

const env = {
  ADMIN_PASSWORD_HASH: `scrypt:abcd:${'0'.repeat(128)}`,
  SESSION_SECRET: 's'.repeat(32),
  ADMIN_ORIGIN: 'https://admin.matis-wostry.com',
};

describe('loadConfig', () => {
  test.each(Object.keys(env))('refuse de démarrer sans %s', (key) => {
    const { [key as keyof typeof env]: _removed, ...rest } = env;
    expect(() => loadConfig(rest)).toThrow(new RegExp(key));
  });

  test('refuse un secret de session trop court', () => {
    expect(() => loadConfig({ ...env, SESSION_SECRET: 'court' })).toThrow(/SESSION_SECRET/);
  });

  test.each(['pas-un-hash', 'scrypt:abcd:court', ` ${env.ADMIN_PASSWORD_HASH}`])(
    'un hash mal collé (%s) empêche le démarrage au lieu de refuser toute connexion',
    (hash) => {
      expect(() => loadConfig({ ...env, ADMIN_PASSWORD_HASH: hash })).toThrow(/ADMIN_PASSWORD_HASH/);
    },
  );

  test('un hash copié sans son début « scrypt: » le dit clairement', () => {
    expect(() => loadConfig({ ...env, ADMIN_PASSWORD_HASH: env.ADMIN_PASSWORD_HASH.replace('scrypt:', '') })).toThrow(/scrypt:/);
  });

  test.each(['https://admin.matis-wostry.com/', 'https://admin.matis-wostry.com/page'])(
    'l’origine %s est ramenée à ce que le navigateur envoie',
    (origin) => {
      expect(loadConfig({ ...env, ADMIN_ORIGIN: origin }).adminOrigin).toBe('https://admin.matis-wostry.com');
    },
  );

  test('applique des valeurs par défaut sûres', () => {
    expect(loadConfig(env)).toMatchObject({
      cookieSecure: true,
      deploySites: [],
      port: 3000,
      databasePath: 'data/data.db',
      mediaDir: 'data/media',
    });
    expect(loadConfig(env).githubDispatchToken).toBeUndefined();
  });

  test('seule la valeur false désactive le cookie sécurisé', () => {
    expect(loadConfig({ ...env, COOKIE_SECURE: 'false' }).cookieSecure).toBe(false);
    expect(loadConfig({ ...env, COOKIE_SECURE: '0' }).cookieSecure).toBe(true);
  });

  test('lit la liste des sites à déployer', () => {
    const site = { name: 'classique', repo: 'Matis-Wostry/cv', workflow: 'deploy.yml', ref: 'main' };
    const config = loadConfig({ ...env, DEPLOY_SITES: JSON.stringify([site]), GITHUB_DISPATCH_TOKEN: 'jeton' });
    expect(config.deploySites).toEqual([site]);
    expect(config.githubDispatchToken).toBe('jeton');
  });

  test('des sites sans jeton empêchent le démarrage plutôt que d’échouer à la publication', () => {
    const site = { name: 'classique', repo: 'Matis-Wostry/cv', workflow: 'deploy.yml', ref: 'main' };
    expect(() => loadConfig({ ...env, DEPLOY_SITES: JSON.stringify([site]) })).toThrow(/GITHUB_DISPATCH_TOKEN/);
  });

  describe('formulaire de contact', () => {
    const mail = {
      CONTACT_ORIGINS: 'https://matis-wostry.com/, https://www.matis-wostry.com',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_USER: 'matiswostry.pro@gmail.com',
      SMTP_PASSWORD: 'mot de passe application',
    };

    test('sans réglage du mail, le formulaire est désactivé', () => {
      expect(loadConfig(env).contact).toBeUndefined();
    });

    test('lit le serveur de mail, les origines du site, et envoie à l’adresse du compte par défaut', () => {
      expect(loadConfig({ ...env, ...mail }).contact).toEqual({
        origins: ['https://matis-wostry.com', 'https://www.matis-wostry.com'],
        to: 'matiswostry.pro@gmail.com',
        from: 'matiswostry.pro@gmail.com',
        smtp: { host: 'smtp.gmail.com', port: 465, secure: true, user: 'matiswostry.pro@gmail.com', password: 'mot de passe application' },
      });
    });

    test('le destinataire et le port se changent, et le port 587 passe en STARTTLS', () => {
      const contact = loadConfig({ ...env, ...mail, CONTACT_TO: 'autre@example.test', SMTP_PORT: '587' }).contact;
      expect(contact?.to).toBe('autre@example.test');
      expect(contact?.smtp).toMatchObject({ port: 587, secure: false });
    });

    test.each(Object.keys(mail))('un réglage du mail incomplet, sans %s, empêche le démarrage', (key) => {
      const { [key as keyof typeof mail]: _removed, ...rest } = mail;
      expect(() => loadConfig({ ...env, ...rest })).toThrow(new RegExp(key));
    });
  });

  test('une liste de sites illisible empêche le démarrage', () => {
    expect(() => loadConfig({ ...env, DEPLOY_SITES: 'pas du json' })).toThrow(/DEPLOY_SITES/);
    expect(() => loadConfig({ ...env, DEPLOY_SITES: '[{"name":"x"}]' })).toThrow(/DEPLOY_SITES/);
  });
});
