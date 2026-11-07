import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api/client.ts';
import { ReloginDialog } from '../components/ReloginDialog.tsx';

type SessionStatus = 'loading' | 'in' | 'out';

export class ReauthCancelled extends Error {}

type Session = {
  status: SessionStatus;
  login(password: string): Promise<void>;
  logout(): Promise<void>;
  /** Ouvre la reconnexion par-dessus la page, sans la démonter. Se résout une fois reconnecté. */
  reauthenticate(): Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export const useSession = (): Session => {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession doit être utilisé dans SessionProvider');
  return session;
};

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [relogin, setRelogin] = useState(false);
  const pending = useRef<{ promise: Promise<void>; resolve(): void; reject(error: Error): void } | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get('/auth/me')
      .then(() => active && setStatus('in'))
      .catch(() => active && setStatus('out'));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (password: string) => {
    await api.post('/auth/login', { password });
    setStatus('in');
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch((error: unknown) => {
      // Une session déjà expirée revient au même qu'une déconnexion réussie.
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    });
    setStatus('out');
  }, []);

  const reauthenticate = useCallback(() => {
    if (pending.current) return pending.current.promise;
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    pending.current = { promise, resolve, reject };
    setRelogin(true);
    return promise;
  }, []);

  const closeRelogin = useCallback((settle: (current: NonNullable<typeof pending.current>) => void) => {
    const current = pending.current;
    pending.current = null;
    setRelogin(false);
    if (current) settle(current);
  }, []);

  const value = useMemo(() => ({ status, login, logout, reauthenticate }), [status, login, logout, reauthenticate]);

  return (
    <SessionContext.Provider value={value}>
      {children}
      {relogin && (
        <ReloginDialog
          onSubmit={login}
          onDone={() => closeRelogin((current) => current.resolve())}
          onCancel={() => closeRelogin((current) => current.reject(new ReauthCancelled('Reconnexion annulée')))}
        />
      )}
    </SessionContext.Provider>
  );
};
