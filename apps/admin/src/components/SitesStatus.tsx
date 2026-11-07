import { useStatus, type Deploy } from '../hooks/useStatus.ts';

const Line = ({ kind, children }: { kind: 'ok' | 'bad' | 'busy' | 'idle'; children: React.ReactNode }) => (
  <span className="status-line">
    <i className={`status-dot ${kind}`} aria-hidden="true" />
    {children}
  </span>
);

const Failure = ({ deploy }: { deploy: Deploy }) => (
  <Line kind="bad">
    {deploy.site} : échec{deploy.error ? ` (${deploy.error})` : ''}
    {deploy.url && (
      <>
        {' '}
        <a href={deploy.url} target="_blank" rel="noreferrer" aria-label={`Voir le déploiement de ${deploy.site}`}>voir</a>
      </>
    )}
  </Line>
);

export const SitesStatus = () => {
  const { data } = useStatus();
  if (!data) return null;

  const { deploys, lastPublishedAt } = data;
  if (!lastPublishedAt) return <Line kind="idle">Jamais publié</Line>;
  if (deploys.length === 0) return <Line kind="idle">Publié. Aucun site à déployer pour l’instant.</Line>;

  const failures = deploys.filter((deploy) => deploy.state === 'failure');
  if (failures.length > 0) return <>{failures.map((deploy) => <Failure key={deploy.site} deploy={deploy} />)}</>;
  if (deploys.some((deploy) => deploy.state === 'pending' || deploy.state === 'in_progress')) return <Line kind="busy">Déploiement en cours</Line>;
  if (deploys.some((deploy) => deploy.state === 'unknown')) return <Line kind="idle">État des sites inconnu</Line>;
  return <Line kind="ok">Sites à jour</Line>;
};
