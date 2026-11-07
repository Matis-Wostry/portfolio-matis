import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, NavLink, Outlet, useMatches, useParams } from 'react-router';
import type { DraftState } from '@portfolio-matis/content';
import { api } from '../api/client.ts';
import { useSession } from '../app/session.tsx';
import { DRAFT_QUERY } from '../app/queries.ts';
import { DraftBadge } from '../components/DraftBadge.tsx';
import { PublishButton } from '../components/PublishButton.tsx';
import { SitesStatus } from '../components/SitesStatus.tsx';
import { LoginPage } from '../pages/LoginPage.tsx';

export type RouteHandle = { section: string };

const useSectionTitle = (): string => {
  const matches = useMatches();
  const handle = matches.map((match) => match.handle as RouteHandle | undefined).findLast((h) => h?.section);
  return handle?.section ?? '';
};

const Sidebar = ({ onNavigate, open }: { onNavigate(): void; open: boolean }) => {
  const { logout } = useSession();
  const { data } = useQuery({ queryKey: DRAFT_QUERY, queryFn: () => api.get<DraftState>('/admin/draft') });
  const links = [
    { to: '/projets', label: 'Projets', count: data?.projects.length },
    { to: '/experiences', label: 'Expériences', count: data?.experiences.length },
    { to: '/formations', label: 'Formations', count: data?.educations.length },
    { to: '/competences', label: 'Compétences', count: data?.skillCategories.length },
    { to: '/presentation', label: 'Présentation' },
    { to: '/contact', label: 'Contact' },
    { to: '/medias', label: 'Médias' },
  ];

  return (
    <aside className={open ? 'side open' : 'side'}>
      <nav aria-label="Sections">
        {links.map(({ to, label, count }) => (
          <NavLink key={to} to={to} className="nav-link" onClick={onNavigate}>
            {label}
            {count !== undefined && <small>{count}</small>}
          </NavLink>
        ))}
      </nav>
      <div className="side-bottom">
        <SitesStatus />
        <button type="button" className="link-button" onClick={() => void logout()}>Se déconnecter</button>
      </div>
    </aside>
  );
};

const Shell = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const section = useSectionTitle();
  const { id } = useParams();

  return (
    <div className="app">
      <div className="brand">
        <Link to="/projets" className="logo">Portfolio Matis</Link>
        <button type="button" className="btn menu-toggle" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>Menu</button>
      </div>
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <section className="main">
        <header className="top">
          <h1 className="crumb">
            {id ? <><span>{section} /</span> {id}</> : section}
          </h1>
          <DraftBadge />
          <Link to="/apercu" className="btn">Aperçu</Link>
          <PublishButton />
        </header>
        <div className="body">
          <Outlet />
        </div>
      </section>
    </div>
  );
};

export const AppLayout = () => {
  const { status } = useSession();
  if (status === 'loading') return <p className="loading">Chargement…</p>;
  return status === 'out' ? <LoginPage /> : <Shell />;
};
