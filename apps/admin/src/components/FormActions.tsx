import type { EntityForm } from '../hooks/useEntityForm.ts';

type Props = { form: Pick<EntityForm<unknown>, 'saving' | 'saved' | 'message'>; label?: string };

export const FormActions = ({ form, label = 'Enregistrer' }: Props) => (
  <div className="form-actions">
    <button type="submit" className="btn primary" disabled={form.saving}>{label}</button>
    {form.saved && <span className="success" role="status">Enregistré</span>}
    {form.message && <p className="error" role="alert">{form.message}</p>}
  </div>
);
