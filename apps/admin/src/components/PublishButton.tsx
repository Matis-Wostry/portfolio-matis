import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, ApiError, type ApiIssue } from '../api/client.ts';
import { useHasUnsaved } from '../app/unsaved.tsx';
import { useAuthedAction } from '../hooks/useAuthedAction.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

/** L'écran où corriger un problème signalé à la publication. */
const issueLink = (path: string): string | null => {
  const [root, id] = path.split('.');
  const lists: Record<string, string> = {
    projects: '/projets',
    experiences: '/experiences',
    educations: '/formations',
    skillCategories: '/competences',
  };
  if (root === 'profile') return '/presentation';
  if (root === 'contact') return '/contact';
  if (root === 'media') return '/medias';
  if (root === 'projectCategories') return '/projets';
  const base = root ? lists[root] : undefined;
  return base ? `${base}/${id}` : null;
};

const IssuesDialog = ({ issues, onClose }: { issues: ApiIssue[]; onClose(): void }) => (
  <div className="overlay">
    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="issues-title">
      <h2 id="issues-title">Le contenu n’est pas prêt</h2>
      <p>Rien n’a été publié. À corriger :</p>
      <ul>
        {issues.map((issue) => {
          const to = issueLink(issue.path);
          return <li key={issue.path}>{to ? <Link to={to} onClick={onClose}>{issue.message}</Link> : issue.message}</li>;
        })}
      </ul>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onClose} autoFocus>Fermer</button>
      </div>
    </div>
  </div>
);

export const PublishButton = () => {
  const queryClient = useQueryClient();
  const run = useAuthedAction();
  const hasUnsaved = useHasUnsaved();
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [issues, setIssues] = useState<ApiIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const publish = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setConfirming(false);
    setPublishing(true);
    setError(null);
    try {
      await run(() => api.post('/admin/publish'));
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409 && caught.issues.length > 0) setIssues(caught.issues);
      else setError(caught instanceof ApiError ? caught.message : 'Publication annulée');
    } finally {
      inFlight.current = false;
      setPublishing(false);
      void queryClient.invalidateQueries();
    }
  };

  return (
    <>
      {hasUnsaved && <span className="notice">Enregistrez d’abord vos modifications pour publier.</span>}
      {error && <span className="error" role="alert">{error}</span>}
      <button type="button" className="btn primary" disabled={hasUnsaved || publishing} onClick={() => setConfirming(true)}>
        {publishing ? 'Publication…' : 'Publier'}
      </button>
      {confirming && (
        <ConfirmDialog title="Publier sur les sites ?" confirmLabel="Publier maintenant" onCancel={() => setConfirming(false)} onConfirm={() => void publish()}>
          <p>Tout le contenu enregistré sera figé et les sites seront reconstruits. Un projet pas encore prêt peut être masqué.</p>
        </ConfirmDialog>
      )}
      {issues && <IssuesDialog issues={issues} onClose={() => setIssues(null)} />}
    </>
  );
};
