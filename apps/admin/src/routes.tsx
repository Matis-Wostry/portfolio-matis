import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './layout/AppLayout.tsx';
import { ContactPage } from './pages/ContactPage.tsx';
import { EditEducationPage, EducationsPage, NewEducationPage } from './pages/EducationPages.tsx';
import { EditExperiencePage, ExperiencesPage, NewExperiencePage } from './pages/ExperiencePages.tsx';
import { MediaPage } from './pages/MediaPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { EditProjectPage, NewProjectPage } from './pages/ProjectForm.tsx';
import { ProjectsPage } from './pages/ProjectsPage.tsx';
import { EditSkillPage, NewSkillPage, SkillsPage } from './pages/SkillPages.tsx';

const crud = (path: string, section: string, list: React.ReactNode, create: React.ReactNode, edit: React.ReactNode): RouteObject[] => [
  { path, handle: { section }, element: list },
  { path: `${path}/nouveau`, handle: { section }, element: create },
  { path: `${path}/:id`, handle: { section }, element: edit },
];

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/projets" replace /> },
      ...crud('projets', 'Projets', <ProjectsPage />, <NewProjectPage />, <EditProjectPage />),
      ...crud('experiences', 'Expériences', <ExperiencesPage />, <NewExperiencePage />, <EditExperiencePage />),
      ...crud('formations', 'Formations', <EducationsPage />, <NewEducationPage />, <EditEducationPage />),
      ...crud('competences', 'Compétences', <SkillsPage />, <NewSkillPage />, <EditSkillPage />),
      { path: 'presentation', handle: { section: 'Présentation' }, element: <ProfilePage /> },
      { path: 'contact', handle: { section: 'Contact' }, element: <ContactPage /> },
      { path: 'medias', handle: { section: 'Médias' }, element: <MediaPage /> },
      { path: '*', handle: { section: 'Page introuvable' }, element: <p>Cette page n’existe pas.</p> },
    ],
  },
];
