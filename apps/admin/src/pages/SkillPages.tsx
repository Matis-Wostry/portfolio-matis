import { skillCategorySchema, updateInput, type SkillCategory } from '@portfolio-matis/content';
import { api } from '../api/client.ts';
import { EntityList } from '../components/EntityList.tsx';
import { FormActions } from '../components/FormActions.tsx';
import { TextField } from '../components/FormField.tsx';
import { SlugField } from '../components/SlugField.tsx';
import { TagsField } from '../components/TagsField.tsx';
import { useEntityForm } from '../hooks/useEntityForm.ts';
import { useSlugFromTitle } from '../hooks/useSlugFromTitle.ts';
import { creationSchema, EntityEdit, useGoToCreated } from './entity.tsx';

type Values = { id: string; title: string; skills: string[] };

const Form = ({ initial, existingId }: { initial: Values; existingId?: string }) => {
  const goToCreated = useGoToCreated('/competences');
  const form = useEntityForm<Values, SkillCategory>({
    initial,
    schema: existingId ? updateInput(skillCategorySchema) : creationSchema(skillCategorySchema),
    toPayload: ({ id, ...values }) => ({ ...(existingId ? {} : { id }), ...values }),
    save: (payload) =>
      existingId ? api.put<SkillCategory>(`/admin/skill-categories/${encodeURIComponent(existingId)}`, payload) : api.post<SkillCategory>('/admin/skill-categories', payload),
    ...(existingId ? {} : { onSaved: goToCreated, lockWhileSaving: true }),
  });
  const { values, setField, errorFor } = form;
  const slug = useSlugFromTitle((id) => setField('id', id));

  return (
    <form className="form single" onSubmit={(event) => void form.submit(event)} noValidate>
      <fieldset className="plain" disabled={form.locked}>
      <div className="form-col">
        <TextField
          label="Titre"
          value={values.title}
          error={errorFor('title')}
          onChange={(title) => {
            setField('title', title);
            if (!existingId) slug.onTitle(title);
          }}
        />
        <SlugField value={values.id} readOnly={Boolean(existingId)} error={errorFor('id')} onChange={slug.onId} />
        <TagsField label="Compétences" values={values.skills} error={errorFor('skills')} onChange={(skills) => setField('skills', skills)} />
        <FormActions form={form} />
      </div>
      </fieldset>
    </form>
  );
};

export const SkillsPage = () => (
  <EntityList<SkillCategory>
    title="Compétences"
    path="skill-categories"
    basePath="/competences"
    primary={(row) => row.title}
    meta={(row) => `${row.skills.length} compétences`}
  />
);

export const NewSkillPage = () => <Form initial={{ id: '', title: '', skills: [] }} />;

export const EditSkillPage = () => (
  <EntityEdit<SkillCategory> path="skill-categories">
    {(row, id) => <Form initial={{ id: row.id, title: row.title, skills: row.skills }} existingId={id} />}
  </EntityEdit>
);
