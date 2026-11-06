import { readFile } from 'node:fs/promises';
import { draftContentSchema } from '@portfolio-matis/content';
import { openDatabase } from './db/client.ts';
import { createDraftRepo, seedDraft } from './db/draft-repo.ts';

const [file] = process.argv.slice(2);
if (!file) {
  console.error('Usage : node src/seed.ts <contenu.json>');
  process.exit(1);
}

const content = draftContentSchema.parse(JSON.parse(await readFile(file, 'utf8')));
const db = openDatabase(process.env.DATABASE_PATH ?? 'data/data.db');
try {
  seedDraft(createDraftRepo(db), content);
  console.log(`Brouillon rempli : ${content.projects.length} projets. Rien n'est publié.`);
} finally {
  db.$client.close();
}
