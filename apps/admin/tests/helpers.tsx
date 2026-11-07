import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { AppProviders } from '../src/app/providers.tsx';
import { routes } from '../src/routes.tsx';

export const GOOD_PASSWORD = 'bon-mot-de-passe';

type Row = Record<string, unknown> & { id: string; position: number };

export type FakeState = {
  authenticated: boolean;
  profile: Record<string, unknown> | null;
  contact: Record<string, unknown> | null;
  experiences: Row[];
  educations: Row[];
  projects: Row[];
  'skill-categories': Row[];
  'project-categories': Row[];
  media: Record<string, unknown>[];
  status: { hasUnpublishedChanges: boolean; lastPublishedAt: string | null; deploys: Record<string, unknown>[] };
};

type Call = { method: string; path: string; body: unknown };
type Canned = { status: number; body?: unknown } | 'network-error' | (() => Promise<{ status: number; body?: unknown }>);

const COLLECTIONS = ['experiences', 'educations', 'projects', 'skill-categories'] as const;
type CollectionName = (typeof COLLECTIONS)[number];

export const CATEGORIES: Row[] = [
  { id: 'pro', title: 'Projets pro', description: 'En entreprise', position: 0 },
  { id: 'ecole', title: 'Projets école', description: 'Pendant mes études', position: 1 },
  { id: 'perso', title: 'Projets perso', description: 'Pour apprendre', position: 2 },
];

export const project = (over: Partial<Row> = {}): Row => ({
  id: 'pokedex',
  title: 'Pokédex',
  categoryId: 'ecole',
  summary: 'Une API REST documentée',
  context: null,
  work: null,
  result: null,
  techs: ['React'],
  links: [{ label: 'Code', href: 'https://github.com/Matis-Wostry/Pokedex' }],
  captures: [],
  hidden: false,
  position: 0,
  ...over,
});

export const profile = (over: Record<string, unknown> = {}) => ({
  name: 'Matis Wostry',
  role: 'Développeur full-stack junior',
  city: 'Genève',
  about: 'Un texte de présentation',
  search: { contractType: 'Alternance', duration: '1 an', start: 'Septembre 2027', location: 'Genève' },
  goals: ['Décrocher une alternance'],
  motivations: ['Apprendre en construisant'],
  frustrations: ['Les tâches répétitives'],
  workStyle: [{ quality: 'Autonome', proof: 'En freelance.' }],
  softSkills: ['Patient'],
  hobbies: [{ id: 'echecs', label: 'Échecs' }],
  cvFile: null,
  ...over,
});

export const contact = (over: Record<string, unknown> = {}) => ({
  email: 'matis@example.com',
  phone: '+33 6 00 00 00 00',
  links: [{ label: 'GitHub', href: 'https://github.com/Matis-Wostry' }],
  ...over,
});

/** Une fausse API en mémoire, qui suit les vraies routes et note chaque appel. */
export const createFakeApi = (over: Partial<FakeState> = {}) => {
  const state: FakeState = {
    authenticated: true,
    profile: null,
    contact: null,
    experiences: [],
    educations: [],
    projects: [],
    'skill-categories': [],
    'project-categories': [...CATEGORIES],
    media: [],
    status: { hasUnpublishedChanges: true, lastPublishedAt: null, deploys: [] },
    ...over,
  };
  const calls: Call[] = [];
  const canned = new Map<string, Canned[]>();
  let uploads = 0;

  const route = (method: string, path: string, body: unknown): { status: number; body?: unknown } => {
    if (path === '/auth/me') return state.authenticated ? { status: 200, body: { authenticated: true } } : { status: 401, body: { message: 'Session expirée' } };
    if (path === '/auth/login') {
      if ((body as { password: string }).password !== GOOD_PASSWORD) return { status: 401, body: { message: 'Mot de passe incorrect' } };
      state.authenticated = true;
      return { status: 200, body: { ok: true } };
    }
    if (path === '/auth/logout') {
      state.authenticated = false;
      return { status: 200, body: { ok: true } };
    }
    if (!state.authenticated) return { status: 401, body: { message: 'Session expirée : reconnectez-vous' } };

    if (path === '/admin/draft') {
      return {
        status: 200,
        body: {
          profile: state.profile,
          contact: state.contact,
          experiences: state.experiences,
          educations: state.educations,
          projectCategories: state['project-categories'],
          projects: state.projects,
          skillCategories: state['skill-categories'],
        },
      };
    }
    if (path === '/admin/status') return { status: 200, body: state.status };
    if (path === '/admin/publish') {
      state.status = { ...state.status, hasUnpublishedChanges: false, lastPublishedAt: '2026-11-07T08:00:00.000Z' };
      return { status: 200, body: { snapshotId: 1, deploys: [] } };
    }

    for (const singleton of ['profile', 'contact'] as const) {
      if (path === `/admin/${singleton}`) {
        if (method === 'PUT') {
          state[singleton] = body as Record<string, unknown>;
          return { status: 200, body };
        }
        return state[singleton] ? { status: 200, body: state[singleton] } : { status: 404, body: { message: 'Pas encore rempli' } };
      }
    }

    if (path === '/admin/media') {
      if (method === 'POST') {
        uploads += 1;
        const row = { file: `00000000-0000-4000-8000-00000000000${uploads}.png`, originalName: 'photo.png', mime: 'image/png', size: 7, createdAt: '2026-11-07T08:00:00.000Z' };
        state.media.push(row);
        return { status: 201, body: row };
      }
      return { status: 200, body: state.media };
    }
    if (path.startsWith('/admin/media/') && method === 'DELETE') {
      const file = path.split('/').at(-1);
      state.media = state.media.filter((m) => m.file !== file);
      return { status: 204 };
    }

    const categoryMatch = /^\/admin\/project-categories(?:\/([^/]+))?$/.exec(path);
    if (categoryMatch) {
      if (method === 'GET') return { status: 200, body: state['project-categories'] };
      const id = categoryMatch[1] as string;
      const row = { ...(body as object), id, position: ['pro', 'ecole', 'perso'].indexOf(id) } as Row;
      state['project-categories'] = [...state['project-categories'].filter((c) => c.id !== id), row].sort((a, b) => a.position - b.position);
      return { status: 200, body: row };
    }

    const match = /^\/admin\/(experiences|educations|projects|skill-categories)(?:\/([^/]+))?$/.exec(path);
    if (match) {
      const collection = match[1] as CollectionName;
      const key = match[2];
      const rows = state[collection];
      if (key === 'reorder') {
        const { ids } = body as { ids: string[] };
        state[collection] = ids.map((id, position) => ({ ...(rows.find((r) => r.id === id) as Row), position }));
        return { status: 204 };
      }
      if (!key) {
        if (method === 'POST') {
          const row = { ...(body as Row), position: rows.length };
          if (rows.some((r) => r.id === row.id)) return { status: 409, body: { message: `L’identifiant « ${row.id} » existe déjà` } };
          rows.push(row);
          return { status: 201, body: row };
        }
        return { status: 200, body: [...rows].sort((a, b) => a.position - b.position) };
      }
      const index = rows.findIndex((r) => r.id === key);
      if (index < 0) return { status: 404, body: { message: 'Élément introuvable' } };
      if (method === 'PUT') {
        const row = { ...(body as object), id: key, position: (rows[index] as Row).position } as Row;
        rows[index] = row;
        return { status: 200, body: row };
      }
      if (method === 'DELETE') {
        rows.splice(index, 1);
        return { status: 204 };
      }
      return { status: 200, body: rows[index] };
    }
    return { status: 404, body: { message: `Route inconnue de la fausse API : ${method} ${path}` } };
  };

  const fetchImpl = async (input: string, init?: RequestInit): Promise<Response> => {
    const method = init?.method ?? 'GET';
    const path = input.replace(/^https?:\/\/[^/]+/, '');
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    calls.push({ method, path, body });

    const key = `${method} ${path}`;
    const next = canned.get(key)?.shift();
    if (next === 'network-error') throw new TypeError('Failed to fetch');
    const result = typeof next === 'function' ? await next() : (next ?? route(method, path, body));
    const noBody = result.status === 204;
    return new Response(noBody ? null : JSON.stringify(result.body ?? {}), {
      status: result.status,
      headers: noBody ? {} : { 'Content-Type': 'application/json' },
    });
  };

  return {
    state,
    calls,
    fetch: fetchImpl,
    /** La prochaine requête sur cette route reçoit cette réponse. */
    respondOnce: (key: string, response: Canned) => {
      canned.set(key, [...(canned.get(key) ?? []), response]);
    },
    callsTo: (key: string) => calls.filter((c) => `${c.method} ${c.path}` === key),
    expireSession: () => {
      state.authenticated = false;
    },
  };
};

export type FakeApi = ReturnType<typeof createFakeApi>;

export const renderApp = (path: string, api: FakeApi) => {
  vi.stubGlobal('fetch', api.fetch);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, router, user: userEvent.setup() };
};
