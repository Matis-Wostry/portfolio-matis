import type { DeploySite } from '../config.ts';

export type RunState = 'pending' | 'in_progress' | 'success' | 'failure' | 'unknown';

export type RunStatus = { state: RunState; url: string | null };

export interface Dispatcher {
  dispatch(site: DeploySite): Promise<void>;
  /** État du dernier run lancé depuis `since`, sans jamais lever d'erreur. */
  latestRun(site: DeploySite, since: string): Promise<RunStatus>;
}

type WorkflowRun = { created_at: string; html_url: string; status: string; conclusion: string | null };

const NO_RUN_TIMEOUT_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10 * 1000;

const toState = (run: WorkflowRun): RunState => {
  if (run.status !== 'completed') return 'in_progress';
  return run.conclusion === 'success' ? 'success' : 'failure';
};

// GitHub donne ses dates à la seconde : un run lancé juste après l'appel peut sembler antérieur de quelques millisecondes.
const toSeconds = (date: string | number): number => Math.floor(new Date(date).getTime() / 1000);

export const createGithubDispatcher = (
  token: string,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Dispatcher => {
  const request = (site: DeploySite, path: string, init?: RequestInit) =>
    fetchImpl(`https://api.github.com/repos/${site.repo}/actions/workflows/${site.workflow}/${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'portfolio-matis',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

  return {
    dispatch: async (site) => {
      const response = await request(site, 'dispatches', { method: 'POST', body: JSON.stringify({ ref: site.ref }) }).catch(() => {
        throw new Error('GitHub ne répond pas');
      });
      if (!response.ok) throw new Error(`GitHub a répondu ${response.status}`);
    },

    latestRun: async (site, since) => {
      try {
        const query = new URLSearchParams({ event: 'workflow_dispatch', branch: site.ref, per_page: '5' });
        const response = await request(site, `runs?${query}`);
        if (!response.ok) return { state: 'unknown', url: null };

        const { workflow_runs: runs } = (await response.json()) as { workflow_runs: WorkflowRun[] };
        const run = runs.find((candidate) => toSeconds(candidate.created_at) >= toSeconds(since));
        if (run) return { state: toState(run), url: run.html_url };

        const waitedTooLong = now() - new Date(since).getTime() > NO_RUN_TIMEOUT_MS;
        return { state: waitedTooLong ? 'failure' : 'pending', url: null };
      } catch {
        return { state: 'unknown', url: null };
      }
    },
  };
};
