import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';

export const PASSWORD_HASH_PATTERN = /^scrypt:([0-9a-f]+):([0-9a-f]{128})$/;

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS: ScryptOptions = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const scrypt = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => (error ? reject(error) : resolve(key)));
  });

/** Produit la valeur de ADMIN_PASSWORD_HASH : `scrypt:<sel>:<hash>`, en hexadécimal. */
export const hashPassword = async (plain: string): Promise<string> => {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString('hex')}:${(await scrypt(plain, salt)).toString('hex')}`;
};

export const verifyPassword = async (plain: string, stored: string): Promise<boolean> => {
  const match = PASSWORD_HASH_PATTERN.exec(stored);
  if (!match?.[1] || !match[2]) return false;
  const expected = Buffer.from(match[2], 'hex');
  return timingSafeEqual(await scrypt(plain, Buffer.from(match[1], 'hex')), expected);
};
