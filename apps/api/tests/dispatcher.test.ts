import { describe, expect, test } from 'vitest';
import type { DeploySite } from '../src/config.ts';
import { createGithubDispatcher } from '../src/deploy/dispatcher.ts';

const SITE: DeploySite = { name: 'classique', repo: 'Matis-Wostry/cv', workflow: 'deploy.yml', ref: 'main' };
const SINCE = '2026-11-06T22:00:00.500Z';
const RUN_URL = 'https://github.com/Matis-Wostry/cv/actions/runs/1';

type Call = { url: string; init: RequestInit | undefined };

const fakeFetch = (respond: () => Response | Promise<Response>) => {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return respond();
  }) as typeof fetch;
  return { calls, fetchImpl };
};

const runs = (workflow_runs: object[]) => new Response(JSON.stringify({ workflow_runs }), { status: 200 });

const run = (over: object) => ({ created_at: '2026-11-06T22:00:01Z', html_url: RUN_URL, status: 'completed', conclusion: 'success', ...over });

describe('dispatch', () => {
  test('appelle le workflow du site avec sa branche et le jeton', async () => {
    const { calls, fetchImpl } = fakeFetch(() => new Response(null, { status: 204 }));
    await createGithubDispatcher('jeton', fetchImpl).dispatch(SITE);

    expect(calls[0]?.url).toBe('https://api.github.com/repos/Matis-Wostry/cv/actions/workflows/deploy.yml/dispatches');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ ref: 'main' });
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe('Bearer jeton');
  });

  test('un refus de GitHub lève une erreur, sans révéler le jeton', async () => {
    const { fetchImpl } = fakeFetch(() => new Response('{}', { status: 403 }));
    const failure = createGithubDispatcher('jeton-secret', fetchImpl).dispatch(SITE);
    await expect(failure).rejects.toThrow(/403/);
    await expect(failure).rejects.not.toThrow(/jeton-secret/);
  });
});

describe('latestRun', () => {
  const latest = (response: Response, now = '2026-11-06T22:01:00.000Z') =>
    createGithubDispatcher('jeton', fakeFetch(() => response).fetchImpl, () => Date.parse(now)).latestRun(SITE, SINCE);

  test.each([
    ['queued', null, 'in_progress'],
    ['in_progress', null, 'in_progress'],
    ['completed', 'success', 'success'],
    ['completed', 'failure', 'failure'],
    ['completed', 'cancelled', 'failure'],
  ])('status %s et conclusion %s donnent %s', async (status, conclusion, state) => {
    await expect(latest(runs([run({ status, conclusion })]))).resolves.toEqual({ state, url: RUN_URL });
  });

  test('sans run, le déploiement est en attente', async () => {
    await expect(latest(runs([]))).resolves.toEqual({ state: 'pending', url: null });
  });

  test('un run antérieur au déclenchement est ignoré', async () => {
    await expect(latest(runs([run({ created_at: '2026-11-06T21:00:00Z' })]))).resolves.toEqual({ state: 'pending', url: null });
  });

  test('un run créé dans la même seconde que le déclenchement compte', async () => {
    await expect(latest(runs([run({ created_at: '2026-11-06T22:00:00Z' })]))).resolves.toMatchObject({ state: 'success' });
  });

  test('sans run après 10 minutes, le déploiement est considéré en échec', async () => {
    await expect(latest(runs([]), '2026-11-06T22:11:00.000Z')).resolves.toEqual({ state: 'failure', url: null });
  });

  test('GitHub injoignable donne un état inconnu, sans lever d’erreur', async () => {
    const { fetchImpl } = fakeFetch(() => Promise.reject(new Error('réseau')));
    await expect(createGithubDispatcher('jeton', fetchImpl).latestRun(SITE, SINCE)).resolves.toEqual({ state: 'unknown', url: null });
    await expect(latest(new Response('{}', { status: 500 }))).resolves.toEqual({ state: 'unknown', url: null });
  });

  test('interroge les runs déclenchés à la main sur la bonne branche', async () => {
    const { calls, fetchImpl } = fakeFetch(() => runs([]));
    await createGithubDispatcher('jeton', fetchImpl).latestRun(SITE, SINCE);
    const url = new URL(calls[0]?.url ?? '');
    expect(url.pathname).toBe('/repos/Matis-Wostry/cv/actions/workflows/deploy.yml/runs');
    expect(url.searchParams.get('event')).toBe('workflow_dispatch');
    expect(url.searchParams.get('branch')).toBe('main');
  });
});
