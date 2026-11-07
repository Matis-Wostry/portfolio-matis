import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.ts';
import { STATUS_QUERY } from '../app/queries.ts';

export type DeployState = 'pending' | 'in_progress' | 'success' | 'failure' | 'unknown';

export type Deploy = { site: string; state: DeployState; url: string | null; error: string | null };

export type Status = {
  hasUnpublishedChanges: boolean;
  lastPublishedAt: string | null;
  deploys: Deploy[];
};

const BUSY_INTERVAL_MS = 15_000;
// GitHub n'a pas répondu : on réessaie, moins souvent, jusqu'à connaître le résultat.
const UNKNOWN_INTERVAL_MS = 60_000;

const refetchInterval = (status: Status | undefined): number | false => {
  if (!status) return false;
  if (status.deploys.some((deploy) => deploy.state === 'pending' || deploy.state === 'in_progress')) return BUSY_INTERVAL_MS;
  return status.deploys.some((deploy) => deploy.state === 'unknown') ? UNKNOWN_INTERVAL_MS : false;
};

export const useStatus = () =>
  useQuery({
    queryKey: STATUS_QUERY,
    queryFn: () => api.get<Status>('/admin/status'),
    refetchInterval: (query) => refetchInterval(query.state.data),
    // Une interrogation de fond n'ouvre pas la reconnexion : seule une action de Matis le fait.
    meta: { background: true },
  });
