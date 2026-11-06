import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildProposal, readClassique, readJeu, renderEcarts } from './index.ts';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');

const { values } = parseArgs({
  options: {
    jeu: { type: 'string', default: resolve(repoRoot, '..', 'jeu') },
    classique: { type: 'string', default: resolve(repoRoot, '..', 'classique') },
    out: { type: 'string', default: join(repoRoot, 'import') },
  },
});

const jeu = await readJeu(values.jeu);
const classique = readClassique(await readFile(join(values.classique, 'index.html'), 'utf8'));
const { content, ecarts } = buildProposal(jeu, classique);

await mkdir(values.out, { recursive: true });
await writeFile(join(values.out, 'proposition.json'), `${JSON.stringify(content, null, 2)}\n`);
await writeFile(join(values.out, 'ecarts.md'), renderEcarts(ecarts));

console.log(`${content.projects.length} projets, ${content.skillCategories.length} catégories de compétences, ${ecarts.length} écarts`);
console.log(`Écrit dans ${values.out}`);
