import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import type { DraftState } from '@portfolio-matis/content';
import { api, ApiError, type ApiIssue } from '../api/client.ts';
import { DRAFT_QUERY } from '../app/queries.ts';
import { useHasUnsaved } from '../app/unsaved.tsx';
import { useAuthedAction } from '../hooks/useAuthedAction.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

type ListKey = 'projects' | 'experiences' | 'educations' | 'skillCategories';

const LISTS: Record<ListKey, { page: string; name(row: Record<string, unknown>): string }> = {
  projects: { page: '/projets', name: (row) => String(row.title) },
  experiences: { page: '/experiences', name: (row) => String(row.title) },
  educations: { page: '/formations', name: (row) => String(row.degree) },
  skillCategories: { page: '/competences', name: (row) => String(row.title) },
};

type IssueTarget = { to: string | null; name: string | null };

/**
 * L'écran où corriger un problème signalé à la publication. L'API désigne un élément par son identifiant
 * (`projects.pokedex.categoryId`), ou par sa position quand le brouillon ne respecte plus le schéma (`projects.1.summary`).
 */
const issueTarget = (path: string, draft: DraftState | undefined): IssueTarget => {
  const [root, key] = path.split('.');
  if (root === 'profile') return { to: '/presentation', name: null };
  if (root === 'contact') return { to: '/contact', name: null };
  if (root === 'media') return { to: '/medias', name: null };
  if (root === 'projectCategories') return { to: '/projets', name: null };
  if (!root || !(root in LISTS) || key === undefined) return { to: null, name: null };

  const list = LISTS[root as ListKey];
  const rows = (draft?.[root as ListKey] ?? []) as unknown as Record<string, unknown>[];
  const row = /^\d+$/.test(key) ? rows[Number(key)] : rows.find((candidate) => candidate.id === key);
  if (row) return { to: `${list.page}/${String(row.id)}`, name: list.name(row) };
  return /^\d+$/.test(key) ? { to: list.page, name: null } : { to: `${list.page}/${key}`, name: null };
};

const IssuesDialog = ({ issues, draft, onClose }: { issues: ApiIssue[]; draft: DraftState | undefined; onClose(): void }) => (
  <div className="overlay">
    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="issues-title">
      <h2 id="issues-title">Le contenu n’est pas prêt</h2>
      <p>Rien n’a été publié. À corriger :</p>
      <ul>
        {issues.map((issue) => {
          const { to, name } = issueTarget(issue.path, draft);
          const text = name ? `${issue.message} (${name})` : issue.message;
          return <li key={issue.path}>{to ? <Link to={to} onClick={onClose}>{text}</Link> : text}</li>;
        })}
      </ul>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onClose} autoFocus>Fermer</button>
      </div>
    </div>
  </div>
);

type PublishResult = { snapshotId: number; deploys: { site: string; error: string | null }[] };

export const PublishButton = () => {
  const queryClient = useQueryClient();
  const run = useAuthedAction();
  const hasUnsaved = useHasUnsaved();
  const { data: draft } = useQuery({ queryKey: DRAFT_QUERY, queryFn: () => api.get<DraftState>('/admin/draft') });
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
      const result = await run(() => api.post<PublishResult>('/admin/publish'));
      // Le contenu est publié, mais un site n'a pas pu être relancé : à dire ici, car l'état des sites n'est pas visible sur téléphone.
      const refused = result.deploys.filter((deploy) => deploy.error);
      if (refused.length > 0) {
        setError(`Publié, mais ${refused.map((deploy) => `${deploy.site} n’a pas pu être relancé : ${deploy.error}`).join(' ; ')}`);
      }
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
      {issues && <IssuesDialog issues={issues} draft={draft} onClose={() => setIssues(null)} />}
    </>
  );
};
