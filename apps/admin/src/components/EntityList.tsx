import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '../api/client.ts';
import { useAuthedAction } from '../hooks/useAuthedAction.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { QueryState } from './QueryState.tsx';

type Row = { id: string };

/**
 * Place `id` à l'endroit de `target` dans l'ordre complet : juste avant s'il monte, juste après s'il descend.
 * Les éléments entre les deux, cachés par un filtre, gardent leur ordre.
 */
export const moveId = (ids: string[], id: string, target: string): string[] => {
  const goesDown = ids.indexOf(target) > ids.indexOf(id);
  const rest = ids.filter((candidate) => candidate !== id);
  rest.splice(rest.indexOf(target) + (goesDown ? 1 : 0), 0, id);
  return rest;
};

type Props<T extends Row> = {
  title: string;
  /** Chemin de la collection dans l'API, après /admin/. */
  path: string;
  /** Adresse de la page dans l'interface. */
  basePath: string;
  primary(row: T): string;
  meta?(row: T): string;
  flag?(row: T): string | null;
  /** N'affiche que les éléments retenus ; monter et descendre se font alors parmi eux. */
  filter?(row: T): boolean;
  /** Le texte d'une liste que le filtre a vidée. */
  filteredEmptyText?: string;
  /** L'adresse du bouton Ajouter, si elle porte plus que la création simple. */
  addTo?: string;
  /** D'autres commandes, à côté du bouton Ajouter. */
  toolbar?: ReactNode;
  /** Les filtres, entre les commandes et la liste. */
  filters?: ReactNode;
};

export const EntityList = <T extends Row>({ title, path, basePath, primary, meta, flag, filter, filteredEmptyText, addTo, toolbar, filters }: Props<T>) => {
  const queryClient = useQueryClient();
  const run = useAuthedAction();
  const query = useQuery({ queryKey: ['collection', path], queryFn: () => api.get<T[]>(`/admin/${path}`) });
  const [toDelete, setToDelete] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await run(action);
      await queryClient.invalidateQueries();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Action annulée');
    } finally {
      setBusy(false);
    }
  };

  const move = (rows: T[], row: T, neighbour: T) => {
    const ids = moveId(rows.map((candidate) => candidate.id), row.id, neighbour.id);
    void act(() => api.post(`/admin/${path}/reorder`, { ids }));
  };

  return (
    <>
      <div className="page-actions">
        <Link to={addTo ?? `${basePath}/nouveau`} className="btn primary">Ajouter</Link>
        {toolbar}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      {filters}
      <QueryState query={query}>
        {(rows) => {
          if (rows.length === 0) return <p className="notice">Rien pour l’instant.</p>;
          const visible = filter ? rows.filter(filter) : rows;
          if (visible.length === 0) return <p className="notice">{filteredEmptyText ?? 'Rien pour l’instant.'}</p>;
          return (
            <ul className="list" aria-label={title}>
              {visible.map((row, index) => {
                const name = primary(row);
                const flagText = flag?.(row);
                const previous = visible[index - 1];
                const next = visible[index + 1];
                return (
                  <li className="list-item" key={row.id}>
                    <div className="list-main">
                      <Link to={`${basePath}/${row.id}`}>{name}</Link>
                      {meta && <span className="list-meta">{meta(row)}</span>}
                    </div>
                    {flagText && <span className="flag">{flagText}</span>}
                    <div className="list-actions">
                      <button type="button" className="btn small" aria-label={`Monter ${name}`} disabled={busy || !previous} onClick={() => previous && move(rows, row, previous)}>↑</button>
                      <button type="button" className="btn small" aria-label={`Descendre ${name}`} disabled={busy || !next} onClick={() => next && move(rows, row, next)}>↓</button>
                      <button type="button" className="btn small danger" aria-label={`Supprimer ${name}`} disabled={busy} onClick={() => setToDelete(row)}>Supprimer</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          );
        }}
      </QueryState>
      {toDelete && (
        <ConfirmDialog
          title="Supprimer cet élément ?"
          confirmLabel="Supprimer"
          busy={busy}
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            const { id } = toDelete;
            setToDelete(null);
            void act(() => api.delete(`/admin/${path}/${encodeURIComponent(id)}`));
          }}
        >
          <p>« {primary(toDelete)} » disparaîtra à la prochaine publication.</p>
        </ConfirmDialog>
      )}
    </>
  );
};
