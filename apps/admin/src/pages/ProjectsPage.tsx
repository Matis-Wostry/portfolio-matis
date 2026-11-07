import { useQuery } from '@tanstack/react-query';
import { PROJECT_CATEGORY_IDS, projectCategorySchema, updateInput, type Project, type ProjectCategory } from '@portfolio-matis/content';
import { api } from '../api/client.ts';
import { EntityList } from '../components/EntityList.tsx';
import { FormActions } from '../components/FormActions.tsx';
import { Group, TextField } from '../components/FormField.tsx';
import { QueryState } from '../components/QueryState.tsx';
import { useEntityForm } from '../hooks/useEntityForm.ts';

const CATEGORY_NAMES: Record<ProjectCategory['id'], string> = { pro: 'Pro', ecole: 'École', perso: 'Perso' };

const CategoryRow = ({ id, initial }: { id: ProjectCategory['id']; initial: { title: string; description: string } }) => {
  const form = useEntityForm({
    initial,
    schema: updateInput(projectCategorySchema),
    save: (payload) => api.put(`/admin/project-categories/${id}`, payload),
  });
  return (
    <form className="form-col" onSubmit={(event) => void form.submit(event)} noValidate aria-label={`Catégorie ${CATEGORY_NAMES[id]}`}>
      <h4>{CATEGORY_NAMES[id]}</h4>
      <TextField label="Titre" value={form.values.title} error={form.errorFor('title')} onChange={(title) => form.setField('title', title)} />
      <TextField label="Description" value={form.values.description} error={form.errorFor('description')} onChange={(description) => form.setField('description', description)} />
      <FormActions form={form} />
    </form>
  );
};

const CategoriesPanel = () => {
  const query = useQuery({
    queryKey: ['collection', 'project-categories'],
    queryFn: () => api.get<ProjectCategory[]>('/admin/project-categories'),
  });
  return (
    <Group title="Catégories de projets">
      <QueryState query={query}>
        {(rows) =>
          PROJECT_CATEGORY_IDS.map((id) => {
            const row = rows.find((candidate) => candidate.id === id);
            return <CategoryRow key={id} id={id} initial={{ title: row?.title ?? '', description: row?.description ?? '' }} />;
          })
        }
      </QueryState>
    </Group>
  );
};

export const ProjectsPage = () => (
  <div className="form">
    <div className="form-col">
      <EntityList<Project>
        title="Projets"
        path="projects"
        basePath="/projets"
        primary={(row) => row.title}
        meta={(row) => `${CATEGORY_NAMES[row.categoryId] ?? row.categoryId} · ${row.summary}`}
        flag={(row) => (row.hidden ? 'Masqué' : null)}
      />
    </div>
    <div className="form-col">
      <CategoriesPanel />
    </div>
  </div>
);
