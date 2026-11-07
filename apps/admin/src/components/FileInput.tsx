import { useId, useState, type ChangeEvent } from 'react';
import { api, ApiError } from '../api/client.ts';
import { useAuthedAction } from '../hooks/useAuthedAction.ts';

export type MediaRow = { file: string; originalName: string; mime: string; size: number; createdAt: string };

type Props = {
  label: string;
  accept: string;
  onUploaded(media: MediaRow): void;
};

/** Envoie le fichier dès qu'il est choisi ; un refus du serveur s'affiche sans toucher au formulaire. */
export const FileInput = ({ label, accept, onUploaded }: Props) => {
  const id = useId();
  const run = useAuthedAction();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await run(() => api.upload<MediaRow>('/admin/media', file)));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Envoi annulé');
    } finally {
      setBusy(false);
      input.value = '';
    }
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="file" accept={accept} disabled={busy} onChange={(event) => void onChange(event)} />
      {busy && <p className="hint">Envoi…</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
};
