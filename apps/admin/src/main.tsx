import '@fontsource/pixelify-sans/400.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppProviders } from './app/providers.tsx';
import { routes } from './routes.tsx';
import './theme.css';

const root = document.getElementById('root');
if (!root) throw new Error('Élément racine introuvable');

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={createBrowserRouter(routes)} />
    </AppProviders>
  </StrictMode>,
);
