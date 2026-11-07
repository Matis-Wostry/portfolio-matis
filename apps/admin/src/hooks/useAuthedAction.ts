import { useCallback } from 'react';
import { ApiError } from '../api/client.ts';
import { useSession } from '../app/session.tsx';

/** Exécute une action ; si la session a expiré, demande la reconnexion par-dessus la page puis la relance. */
export const useAuthedAction = () => {
  const { reauthenticate } = useSession();
  return useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      try {
        return await action();
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) throw error;
        await reauthenticate();
        return action();
      }
    },
    [reauthenticate],
  );
};
