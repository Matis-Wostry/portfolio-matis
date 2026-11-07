import { SECTIONS, type Sections } from './render.ts';

const occurrences = (text: string, search: string): number => text.split(search).length - 1;

/**
 * Remplace le contenu entre `<!-- content:x -->` et `<!-- /content:x -->`, marqueurs compris dans le résultat :
 * index.html sert ainsi à la fois de gabarit et de résultat. Rien d'autre ne change, au caractère près.
 * Le remplacement se fait par découpage, jamais par une chaîne de remplacement : `$&` reste du texte.
 */
export const applySections = (html: string, sections: Sections): string => {
  let result = html;
  for (const id of SECTIONS) {
    const open = `<!-- content:${id} -->`;
    const close = `<!-- /content:${id} -->`;
    if (occurrences(result, open) !== 1 || occurrences(result, close) !== 1) {
      throw new Error(`Section « ${id} » : index.html doit contenir une seule fois ${open} et ${close}`);
    }
    const openAt = result.indexOf(open);
    const start = openAt + open.length;
    const end = result.indexOf(close);
    if (end < start) throw new Error(`Section « ${id} » : ${close} arrive avant ${open}`);

    const body = sections[id];
    let inner: string;
    if (!result.slice(start, end).includes('\n')) {
      // Une section écrite sur la ligne de ses marqueurs y reste, comme la balise meta de l'en-tête.
      inner = body;
    } else {
      const lineStart = result.lastIndexOf('\n', openAt) + 1;
      const indent = /^[ \t]*/.exec(result.slice(lineStart, openAt))?.[0] ?? '';
      const lines = body ? body.split('\n').map((line) => (line ? `${indent}${line}` : line)) : [];
      inner = `\n${lines.map((line) => `${line}\n`).join('')}${indent}`;
    }
    result = result.slice(0, start) + inner + result.slice(end);
  }
  return result;
};
