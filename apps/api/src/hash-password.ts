import { createInterface } from 'node:readline/promises';
import { hashPassword } from './auth/password.ts';

// Le mot de passe passe par l'entrée standard pour ne pas rester dans l'historique du terminal.
const prompt = createInterface({ input: process.stdin, output: process.stderr });
const password = await prompt.question('Mot de passe : ');
prompt.close();

if (!password) {
  console.error('Mot de passe vide : rien à faire.');
  process.exit(1);
}

console.log(await hashPassword(password));
