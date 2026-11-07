import { useRef } from 'react';
import { slugify } from '@portfolio-matis/content';

/** Tant qu'on n'a pas écrit l'identifiant soi-même, il suit le titre. */
export const useSlugFromTitle = (setId: (id: string) => void) => {
  const touched = useRef(false);
  return {
    onTitle: (title: string) => {
      if (!touched.current) setId(slugify(title));
    },
    onId: (id: string) => {
      touched.current = true;
      setId(id);
    },
  };
};
