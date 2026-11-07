import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { projectCategorySchema, updateInput, type ProjectCategory } from '@portfolio-matis/content';
import { api, ApiError } from '../api/client.ts';
import { useHasUnsaved } from '../app/unsaved.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { Dialog } from '../components/Dialog.tsx';
import { moveId } from '../components/EntityList.tsx';
import { FormActions } from '../components/FormActions.tsx';
import { TextField } from '../components/FormField.tsx';
import { QueryState } from '../components/QueryState.tsx';
import { SlugField } from '../components/SlugField.tsx';
import { useAuthedAction } from '../hooks/useAuthedAction.ts';
import { useEntityForm } from '../hooks/useEntityForm.ts';
import { useProjectCategories } from '../hooks/useProjectCategories.ts';
import { useSlugFromTitle } from '../hooks/useSlugFromTitle.ts';
import { creationSchema } from './entity.tsx';

const usage = (count: number): string => {
  if (count === 0) return 'Aucun projet';
  if (count === 1) return '1 projet : changez-le de catégorie pour la supprimer';
  return `${count} projets : changez-les de catégorie pour la supprimer`;
};

const CategoryForm = ({ category }: { category: ProjectCategory }) => {
  const form = useEntityForm({
    initial: { title: category.title, description: category.description },
    schema: updateInput(projectCategorySchema),
    save: (payload) => api.put<ProjectCategory>(`/admin/project-categories/${encodeURIComponent(category.id)}`, payload),
  });
  return (
    <form className="form-col" onSubmit={(event) => void form.submit(event)} noValidate aria-label={`Catégorie ${category.title}`}>
      <div className="form-row">
        <TextField label="Titre" value={form.values.title} error={form.errorFor('title')} onChange={(title) => form.setField('title', title)} />
        <TextField label="Description" value={form.values.description} error={form.errorFor('description')} onChange={(description) => form.setField('description', description)} />
      </div>
      <FormActions form={form} />
    </form>
  );
};

const EMPTY = { id: '', title: '', description: '' };

const NewCategoryForm = ({ onCreated }: { onCreated(): void }) => {
  const form = useEntityForm({
    initial: EMPTY,
    schema: creationSchema(projectCategorySchema),
    save: (payload) => api.post<ProjectCategory>('/admin/project-categories', payload),
  });
  const { values, setField, errorFor } = form;
  const slug = useSlugFromTitle((id) => setField('id', id));

  // Une fois créée, la catégorie rejoint la liste et le formulaire repart à vide.
  useEffect(() => {
    if (form.saved) onCreated();
  }, [form.saved, onCreated]);

  return (
    <form className="panel form-col" onSubmit={(event) => void form.submit(event)} noValidate aria-label="Nouvelle catégorie">
      <h3>Nouvelle catégorie</h3>
      <div className="form-row">
        <TextField
          label="Titre"
          value={values.title}
          error={errorFor('title')}
          onChange={(title) => {
            setField('title', title);
            slug.onTitle(title);
          }}
        />
        <SlugField value={values.id} readOnly={false} error={errorFor('id')} onChange={slug.onId} />
      </div>
      <TextField label="Description" value={values.description} error={errorFor('description')} onChange={(description) => setField('description', description)} />
      <FormActions form={form} label="Ajouter la catégorie" />
    </form>
  );
};

type Props = {
  /** Le nombre de projets de chaque catégorie, par identifiant. */
  counts: ReadonlyMap<string, number>;
  onClose(): void;
};

/** Les catégories de projets : les modifier, en ajouter, les ranger, supprimer celles qui sont vides. */
export const ProjectCategoriesDialog = ({ counts, onClose }: Props) => {
  const query = useProjectCategories();
  const queryClient = useQueryClient();
  const run = useAuthedAction();
  const hasUnsaved = useHasUnsaved();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ProjectCategory | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [newFormKey, setNewFormKey] = useState(0);
  const [onCreated] = useState(() => () => setNewFormKey((key) => key + 1));

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await run(action);
      await queryClient.invalidateQueries();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Action annulée');
    } finally {
      setBusy(false);
    }
  };

  const move = (rows: ProjectCategory[], row: ProjectCategory, neighbour: ProjectCategory) => {
    const ids = moveId(rows.map((candidate) => candidate.id), row.id, neighbour.id);
    void act(() => api.post('/admin/project-categories/reorder', { ids }));
  };

  // La fenêtre fermée, ses formulaires disparaissent : une saisie en cours se perdrait sans prévenir.
  const requestClose = () => (hasUnsaved ? setConfirmingClose(true) : onClose());

  return (
    <>
      <Dialog title="Catégories de projets" onClose={requestClose} wide>
        <p className="notice">Les projets se rangent dans ces catégories, dans cet ordre, sur les deux sites.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <QueryState query={query}>
          {(rows) => (
            <ul className="category-list" aria-label="Catégories existantes">
              {rows.map((row, index) => {
                const count = counts.get(row.id) ?? 0;
                const previous = rows[index - 1];
                const next = rows[index + 1];
                return (
                  <li className="panel category-item" key={row.id}>
                    <div className="category-head">
                      <span className="list-meta">{row.id} · {usage(count)}</span>
                      <div className="list-actions">
                        <button type="button" className="btn small" aria-label={`Monter ${row.title}`} disabled={busy || !previous} onClick={() => previous && move(rows, row, previous)}>↑</button>
                        <button type="button" className="btn small" aria-label={`Descendre ${row.title}`} disabled={busy || !next} onClick={() => next && move(rows, row, next)}>↓</button>
                        <button type="button" className="btn small danger" aria-label={`Supprimer ${row.title}`} disabled={busy || count > 0} onClick={() => setToDelete(row)}>Supprimer</button>
                      </div>
                    </div>
                    <CategoryForm category={row} />
                  </li>
                );
              })}
            </ul>
          )}
        </QueryState>
        <NewCategoryForm key={newFormKey} onCreated={onCreated} />
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={requestClose}>Fermer</button>
        </div>
      </Dialog>
      {toDelete && (
        <ConfirmDialog
          title="Supprimer cette catégorie ?"
          confirmLabel="Supprimer"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            const { id } = toDelete;
            setToDelete(null);
            void act(() => api.delete(`/admin/project-categories/${encodeURIComponent(id)}`));
          }}
        >
          <p>« {toDelete.title} » disparaîtra à la prochaine publication.</p>
        </ConfirmDialog>
      )}
      {confirmingClose && (
        <ConfirmDialog
          title="Fermer sans enregistrer ?"
          confirmLabel="Fermer sans enregistrer"
          cancelLabel="Continuer la saisie"
          onCancel={() => setConfirmingClose(false)}
          onConfirm={onClose}
        >
          <p>Une catégorie a des modifications qui n’ont pas été enregistrées.</p>
        </ConfirmDialog>
      )}
    </>
  );
};
