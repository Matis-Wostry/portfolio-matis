import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError, mediaUrl } from '../api/client.ts';
import { MEDIA_QUERY } from '../app/queries.ts';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import type { MediaRow } from '../components/FileInput.tsx';
import { QueryState } from '../components/QueryState.tsx';
import { useAuthedAction } from '../hooks/useAuthedAction.ts';

const formatSize = (bytes: number): string => (bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} ko` : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`);

export const MediaPage = () => {
  const queryClient = useQueryClient();
  const run = useAuthedAction();
  const query = useQuery({ queryKey: MEDIA_QUERY, queryFn: () => api.get<MediaRow[]>('/admin/media') });
  const [toDelete, setToDelete] = useState<MediaRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (row: MediaRow) => {
    setToDelete(null);
    setError(null);
    try {
      await run(() => api.delete(`/admin/media/${encodeURIComponent(row.file)}`));
      await queryClient.invalidateQueries();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Suppression annulée');
    }
  };

  return (
    <>
      <p className="notice">Les captures et le CV s’envoient depuis leur fiche. Cette page sert à supprimer ceux qui ne servent plus.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <QueryState query={query}>
        {(rows) =>
          rows.length === 0 ? (
            <p className="notice">Aucun média pour l’instant.</p>
          ) : (
            <ul className="media-grid" aria-label="Médias">
              {rows.map((row) => (
                <li className="panel media-item" key={row.file}>
                  {row.mime.startsWith('image/') ? (
                    <img src={mediaUrl(row.file)} alt="" />
                  ) : (
                    <a href={mediaUrl(row.file)} target="_blank" rel="noreferrer">Ouvrir le PDF</a>
                  )}
                  <p>{row.originalName} · {formatSize(row.size)}</p>
                  <button type="button" className="btn small danger" aria-label={`Supprimer ${row.originalName}`} onClick={() => setToDelete(row)}>Supprimer</button>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
      {toDelete && (
        <ConfirmDialog title="Supprimer ce média ?" confirmLabel="Supprimer" onCancel={() => setToDelete(null)} onConfirm={() => void remove(toDelete)}>
          <p>« {toDelete.originalName} » sera définitivement supprimé du serveur.</p>
        </ConfirmDialog>
      )}
    </>
  );
};
