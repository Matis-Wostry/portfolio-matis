// node packages/site-classique/src/cli.ts --site <dossier> --out <dossier> (--api <url> | --snapshot <fichier>)
import { parseArgs } from 'node:util';
import { buildSite, type BuildSource } from './build.ts';

const USAGE = 'Usage : node src/cli.ts --site <dossier du site> --out <dossier de sortie> (--api <url> | --snapshot <fichier>)';

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: { site: { type: 'string' }, out: { type: 'string' }, api: { type: 'string' }, snapshot: { type: 'string' } },
  });
  if (!values.site || !values.out || Boolean(values.api) === Boolean(values.snapshot)) throw new Error(USAGE);

  const source: BuildSource = values.api ? { api: values.api.replace(/\/+$/, '') } : { snapshotFile: values.snapshot as string };
  const { missingMedia } = await buildSite({ siteDir: values.site, outDir: values.out, source });
  for (const file of missingMedia) console.warn(`Média absent de assets/media, image manquante : ${file}`);
  console.log(`Site généré dans ${values.out}`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
