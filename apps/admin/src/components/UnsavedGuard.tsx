import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { useHasUnsaved } from '../app/unsaved.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';

/** Le seul garde de l'application : React Router n'accepte qu'un bloqueur à la fois. */
export const UnsavedGuard = () => {
  const hasUnsaved = useHasUnsaved();
  const latest = useRef(hasUnsaved);
  latest.current = hasUnsaved;

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => latest.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!latest.current) return;
      event.preventDefault();
      // Les navigateurs plus anciens n'avertissent que si returnValue est renseigné.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  if (blocker.state !== 'blocked') return null;
  return (
    <ConfirmDialog
      title="Modifications non enregistrées"
      confirmLabel="Quitter sans enregistrer"
      cancelLabel="Rester"
      onConfirm={() => blocker.proceed()}
      onCancel={() => blocker.reset()}
    >
      <p>Si vous quittez cette page, ce que vous venez de saisir sera perdu.</p>
    </ConfirmDialog>
  );
};
