import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client.ts';
import { useSession } from '../app/session.tsx';

export const LoginPage = () => {
  const { login } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(password);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Connexion impossible');
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <form className="panel login-card" onSubmit={submit}>
        <h1 className="logo">Portfolio Matis</h1>
        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn primary" disabled={busy || !password}>Se connecter</button>
      </form>
    </main>
  );
};
