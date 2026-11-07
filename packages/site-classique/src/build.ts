import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { publicSnapshotSchema, type PublicSnapshot } from '@portfolio-matis/content';
import { applySections } from './markers.ts';
import { renderSections } from './render.ts';

export type BuildSource = { api: string } | { snapshotFile: string };
export type BuildOptions = { siteDir: string; outDir: string; source: BuildSource };
export type BuildResult = { missingMedia: string[] };

/** Ce que le serveur reçoit : rien d'autre, ni .git, ni .github, ni README. */
const PUBLISHED = ['style', 'script', 'assets'];
/** L'adresse du CV, déjà utilisée par les deux sites. */
const CV_PATH = join('assets', 'cv', 'CV_Matis_Wostry.pdf');
const TIMEOUT_MS = 15_000;

const fetchFrom = async (url: string, api: string): Promise<Response> => {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    throw new Error(`API injoignable (${api}) : ${error instanceof Error ? error.message : String(error)}`);
  }
};

const readSnapshot = async (source: BuildSource): Promise<unknown> => {
  // Un fichier enregistré sous Windows peut commencer par une marque d'ordre (BOM), que JSON.parse refuse.
  if ('snapshotFile' in source) return JSON.parse(readFileSync(source.snapshotFile, 'utf8').replace(/^﻿/, ''));
  const response = await fetchFrom(`${source.api}/public/snapshot`, source.api);
  if (!response.ok) {
    const hint = response.status === 404 ? ' : aucun contenu publié pour l’instant ?' : '';
    throw new Error(`L’API a répondu ${response.status} à /public/snapshot${hint}`);
  }
  return response.json();
};

const validate = (raw: unknown): PublicSnapshot => {
  const parsed = publicSnapshotSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`);
  throw new Error(`Instantané invalide : ${issues.join(' ; ')}`);
};

/** Les médias, tous récupérés avant la moindre écriture. Sans API, ceux du site servent, et un manquant est signalé. */
const collectMedia = async (files: string[], source: BuildSource, siteDir: string) => {
  const found = new Map<string, Buffer>();
  const missing: string[] = [];
  for (const file of files) {
    if ('api' in source) {
      const response = await fetchFrom(`${source.api}/public/media/${encodeURIComponent(file)}`, source.api);
      if (!response.ok) throw new Error(`Média ${file} : l’API a répondu ${response.status}`);
      found.set(file, Buffer.from(await response.arrayBuffer()));
    } else {
      const local = join(siteDir, 'assets', 'media', file);
      if (existsSync(local)) found.set(file, readFileSync(local));
      else missing.push(file);
    }
  }
  return { found, missing };
};

const isInside = (child: string, parent: string): boolean => {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith('..') && !path.startsWith(sep) && !/^[a-zA-Z]:/.test(path));
};

/**
 * Génère le site classique depuis l'instantané publié. Tout est lu, validé et rendu avant d'écrire :
 * un échec laisse le site et le dernier build intacts.
 */
export const buildSite = async ({ siteDir, outDir, source }: BuildOptions): Promise<BuildResult> => {
  const site = resolve(siteDir);
  const out = resolve(outDir);
  if (isInside(site, out)) throw new Error('Le dossier de sortie ne peut pas être le dossier du site, ni le contenir');

  const snapshot = validate(await readSnapshot(source));
  const captures = [...new Set(snapshot.content.projects.flatMap((project) => project.captures.map((capture) => capture.file)))];
  const cvFile = snapshot.content.profile.cvFile;
  const media = await collectMedia(cvFile ? [...captures, cvFile] : captures, source, site);
  const html = applySections(readFileSync(join(site, 'index.html'), 'utf8'), renderSections(snapshot));

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const dir of PUBLISHED) {
    if (existsSync(join(site, dir))) cpSync(join(site, dir), join(out, dir), { recursive: true });
  }
  rmSync(join(out, 'assets', 'media'), { recursive: true, force: true });
  for (const file of captures) {
    const data = media.found.get(file);
    if (!data) continue;
    mkdirSync(join(out, 'assets', 'media'), { recursive: true });
    writeFileSync(join(out, 'assets', 'media', file), data);
  }
  const cv = cvFile ? media.found.get(cvFile) : undefined;
  if (cv) {
    mkdirSync(join(out, 'assets', 'cv'), { recursive: true });
    writeFileSync(join(out, CV_PATH), cv);
  }
  writeFileSync(join(out, 'index.html'), html);

  // Le gabarit garde le dernier rendu, et la copie du contenu permet de travailler sans l'API.
  writeFileSync(join(site, 'index.html'), html);
  mkdirSync(join(site, 'content'), { recursive: true });
  writeFileSync(join(site, 'content', 'snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`);

  return { missingMedia: media.missing };
};
