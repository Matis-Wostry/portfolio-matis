import { useStatus } from '../hooks/useStatus.ts';

export const DraftBadge = () => {
  const { data } = useStatus();
  if (!data) return null;
  return data.hasUnpublishedChanges ? <span className="badge">Brouillon</span> : <span className="badge published">Publié</span>;
};
