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

const POLL_INTERVAL_MS = 15_000;

const isBusy = (deploy: Deploy): boolean => deploy.state === 'pending' || deploy.state === 'in_progress';

/** Interroge l'état tant qu'un déploiement est en cours, et jamais sinon. */
export const useStatus = () =>
  useQuery({
    queryKey: STATUS_QUERY,
    queryFn: () => api.get<Status>('/admin/status'),
    refetchInterval: (query) => (query.state.data?.deploys.some(isBusy) ? POLL_INTERVAL_MS : false),
  });
