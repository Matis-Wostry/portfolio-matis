export type ApiIssue = { path: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly issues: ApiIssue[];

  constructor(status: number, message: string, issues: ApiIssue[] = []) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

/** En production, l'API est sur son propre domaine ; en développement, Vite lui transmet les requêtes. */
const BASE_URL: string = import.meta.env.VITE_API_URL ?? '';

const send = async (path: string, init: RequestInit): Promise<Response> => {
  try {
    return await fetch(`${BASE_URL}${path}`, { ...init, credentials: 'include' });
  } catch {
    // Le navigateur ne dit pas lequel : l'API arrêtée, ou une ADMIN_ORIGIN qui fait bloquer la réponse.
    throw new ApiError(0, 'Impossible de joindre le serveur : l’API est peut-être arrêtée, ou ADMIN_ORIGIN ne correspond pas à l’adresse de cette interface');
  }
};

const parse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) return undefined as T;
  const body: { message?: string; issues?: ApiIssue[] } | null = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, body?.message ?? `Le serveur a répondu ${response.status}`, body?.issues ?? []);
  }
  return body as T;
};

const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return parse<T>(await send(path, init));
};

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: (path: string) => request<void>('DELETE', path),
  upload: async <T>(path: string, file: File): Promise<T> => {
    const body = new FormData();
    body.append('file', file);
    return parse<T>(await send(path, { method: 'POST', body }));
  },
};

export const mediaUrl = (file: string): string => `${BASE_URL}/admin/media/${encodeURIComponent(file)}`;
