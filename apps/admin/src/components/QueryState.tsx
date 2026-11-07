import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

type Props<T> = {
  query: UseQueryResult<T>;
  children(data: T): ReactNode;
};

/** Garde les données déjà chargées pendant un rechargement : un formulaire en cours n'est jamais démonté. */
export const QueryState = <T,>({ query, children }: Props<T>) => {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.error) return <p className="error" role="alert">{query.error.message}</p>;
  return <p className="loading">Chargement…</p>;
};
