const withoutAccents = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** « Données & API » devient « donnees-api » : la forme d'un identifiant, déduite d'un titre. */
export const slugify = (text: string): string =>
  withoutAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
