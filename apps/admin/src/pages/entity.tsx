import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { z } from 'zod';
import { createInput } from '@portfolio-matis/content';
import { api } from '../api/client.ts';
import { QueryState } from '../components/QueryState.tsx';

/** Charge l'élément de l'adresse et rend son formulaire ; un rechargement ne remet pas le formulaire à zéro. */
export const EntityEdit = <T,>({ path, children }: { path: string; children(row: T, id: string): ReactNode }) => {
  const { id } = useParams();
  const key = id as string;
  const query = useQuery({
    queryKey: ['collection', path, key],
    queryFn: () => api.get<T>(`/admin/${path}/${encodeURIComponent(key)}`),
  });
  return <QueryState query={query}>{(row) => <div key={key}>{children(row, key)}</div>}</QueryState>;
};

/** Une fois créé, on arrive sur la fiche de l'élément. */
export const useGoToCreated = (basePath: string) => {
  const navigate = useNavigate();
  return ({ id }: { id: string }) => navigate(`${basePath}/${id}`, { replace: true });
};

export const orNull = (value: string): string | null => (value.trim() === '' ? null : value);

/** L'adresse `…/nouveau` sert à créer : aucun élément ne peut porter cet identifiant. */
export const creationSchema = <S extends z.ZodRawShape>(schema: z.ZodObject<S>) =>
  createInput(schema).refine((values) => (values as { id?: unknown }).id !== 'nouveau', {
    path: ['id'],
    message: '« nouveau » est réservé : choisissez un autre identifiant',
  });
