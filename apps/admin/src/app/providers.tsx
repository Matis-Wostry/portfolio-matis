import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../api/client.ts';
import { SessionProvider, useSession } from './session.tsx';
import { UnsavedProvider } from './unsaved.tsx';

const QueryProvider = ({ children }: { children: ReactNode }) => {
  const { reauthenticate } = useSession();
  const reauth = useRef(reauthenticate);
  reauth.current = reauthenticate;

  const [client] = useState(() => {
    const created: QueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
      queryCache: new QueryCache({
        onError: (error) => {
          if (!(error instanceof ApiError && error.status === 401)) return;
          reauth
            .current()
            .then(() => created.invalidateQueries())
            .catch(() => undefined);
        },
      }),
    });
    return created;
  });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <SessionProvider>
    <QueryProvider>
      <UnsavedProvider>{children}</UnsavedProvider>
    </QueryProvider>
  </SessionProvider>
);
