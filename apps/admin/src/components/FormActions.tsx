import type { EntityForm } from '../hooks/useEntityForm.ts';

export const FormActions = ({ form }: { form: EntityForm<never> | EntityForm<any> }) => (
  <div className="form-actions">
    <button type="submit" className="btn primary" disabled={form.saving}>Enregistrer</button>
    {form.saved && <span className="success" role="status">Enregistré</span>}
    {form.message && <p className="error" role="alert">{form.message}</p>}
  </div>
);
