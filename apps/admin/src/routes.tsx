import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './layout/AppLayout.tsx';

const Placeholder = () => null;

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/projets" replace /> },
      { path: 'projets', handle: { section: 'Projets' }, element: <Placeholder /> },
      { path: 'contact', handle: { section: 'Contact' }, element: <Placeholder /> },
      { path: '*', handle: { section: 'Page introuvable' }, element: <p>Cette page n’existe pas.</p> },
    ],
  },
];
