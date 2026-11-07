import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client.ts';
import { Dialog } from './Dialog.tsx';

type Props = {
  onSubmit(password: string): Promise<void>;
  onDone(): void;
  onCancel(): void;
};

export const ReloginDialog = ({ onSubmit, onDone, onCancel }: Props) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(password);
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Connexion impossible');
      setBusy(false);
    }
  };

  return (
    <Dialog title="Session expirée" onClose={onCancel}>
        <p>Reconnectez-vous pour continuer. Votre saisie est conservée.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="relogin-password">Mot de passe de reconnexion</label>
            <input
              id="relogin-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={onCancel} disabled={busy}>Annuler</button>
            <button type="submit" className="btn primary" disabled={busy || !password}>Se reconnecter</button>
          </div>
        </form>
    </Dialog>
  );
};
