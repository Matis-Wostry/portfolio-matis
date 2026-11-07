export { slugify } from '@portfolio-matis/content';

const withoutAccents = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '');

const MONTHS: Record<string, string> = {
  janvier: '01',
  fevrier: '02',
  mars: '03',
  avril: '04',
  mai: '05',
  juin: '06',
  juillet: '07',
  aout: '08',
  septembre: '09',
  'sept.': '09',
  octobre: '10',
  novembre: '11',
  decembre: '12',
};

const monthNumber = (word: string): string | undefined => MONTHS[withoutAccents(word).toLowerCase()];

const parsePoint = (text: string, original: string): string => {
  if (/^\d{4}$/.test(text)) return text;
  const match = /^(\S+)\s+(\d{4})$/.exec(text);
  const month = match?.[1] ? monthNumber(match[1]) : undefined;
  if (!match || !month) throw new Error(`Période illisible : « ${original} »`);
  return `${match[2]}-${month}`;
};

/** Convertit une période écrite sur un site ; ne devine jamais une valeur qu'elle ne sait pas lire. */
export const parsePeriod = (period: string): { start: string; end: string | null } => {
  const parts = period.trim().split(/\s*[–-]\s*/);
  const [first, second] = parts;
  if (!first || parts.length > 2) throw new Error(`Période illisible : « ${period} »`);
  const start = parsePoint(first, period);
  if (second === undefined) return { start, end: start };
  return { start, end: /^aujourd['’]hui$/i.test(second) ? null : parsePoint(second, period) };
};

/** Le mois écrit en toutes lettres, avec une majuscule, à partir de son abréviation. */
export const fullMonthName = (word: string): string | undefined => {
  const number = monthNumber(word);
  if (!number) return undefined;
  const names = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  return names[Number(number) - 1];
};
