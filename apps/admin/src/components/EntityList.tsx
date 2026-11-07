import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '../api/client.ts';
import { useAuthedAction } from '../hooks/useAuthedAction.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { QueryState } from './QueryState.tsx';

type Row = { id: string };

type Props<T extends Row> = {
  title: string;
  /** Chemin de la collection dans l'API, après /admin/. */
  path: string;
  /** Adresse de la page dans l'interface. */
  basePath: string;
  primary(row: T): string;
  meta?(row: T): string;
  flag?(row: T): string | null;
};

export const EntityList = <T extends Row>({ title, path, basePath, primary, meta, flag }: Props<T>) => {
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

  const move = (rows: T[], index: number, offset: number) => {
    const ids = rows.map((row) => row.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + offset, 0, moved as string);
    void act(() => api.post(`/admin/${path}/reorder`, { ids }));
  };

  return (
    <>
      <div className="page-actions">
        <Link to={`${basePath}/nouveau`} className="btn primary">Ajouter</Link>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <QueryState query={query}>
        {(rows) =>
          rows.length === 0 ? (
            <p className="notice">Rien pour l’instant.</p>
          ) : (
            <ul className="list" aria-label={title}>
              {rows.map((row, index) => {
                const name = primary(row);
                const flagText = flag?.(row);
                return (
                  <li className="list-item" key={row.id}>
                    <div className="list-main">
                      <Link to={`${basePath}/${row.id}`}>{name}</Link>
                      {meta && <span className="list-meta">{meta(row)}</span>}
                    </div>
                    {flagText && <span className="flag">{flagText}</span>}
                    <div className="list-actions">
                      <button type="button" className="btn small" aria-label={`Monter ${name}`} disabled={busy || index === 0} onClick={() => move(rows, index, -1)}>↑</button>
                      <button type="button" className="btn small" aria-label={`Descendre ${name}`} disabled={busy || index === rows.length - 1} onClick={() => move(rows, index, 1)}>↓</button>
                      <button type="button" className="btn small danger" aria-label={`Supprimer ${name}`} disabled={busy} onClick={() => setToDelete(row)}>Supprimer</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        }
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
