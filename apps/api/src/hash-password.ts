import { createInterface } from 'node:readline/promises';
import { hashPassword } from './auth/password.ts';

/** Lit le mot de passe sans l'afficher, et sans le laisser dans l'historique du terminal. */
const readHidden = (question: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const { stdin, stderr } = process;
    stderr.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let typed = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stderr.write('\n');
          resolve(typed);
          return;
        }
        if (char === '\u0003') {
          stdin.setRawMode(false);
          reject(new Error('Annulé'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          if (typed) {
            typed = typed.slice(0, -1);
            stderr.write('\b \b');
          }
        } else {
          typed += char;
          stderr.write('*');
        }
      }
    };
    stdin.on('data', onData);
  });

// Sans terminal (mot de passe passé par un tube, comme dans la CI), une lecture simple suffit.
const readPiped = async (question: string): Promise<string> => {
  const prompt = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await prompt.question(question);
  prompt.close();
  return answer;
};

const password = await (process.stdin.isTTY ? readHidden : readPiped)('Mot de passe : ');

if (!password) {
  console.error('Mot de passe vide : rien à faire.');
  process.exit(1);
}

console.error('Copiez toute la ligne ci-dessous, y compris « scrypt: » au début, dans ADMIN_PASSWORD_HASH :');
console.log(await hashPassword(password));
