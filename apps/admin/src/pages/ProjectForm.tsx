import { createInput, projectSchema, updateInput, type Project } from '@portfolio-matis/content';
import { api } from '../api/client.ts';
import { CapturesPanel, type CaptureValue } from '../components/CapturesPanel.tsx';
import { FormActions } from '../components/FormActions.tsx';
import { CheckField, Group, SelectField, TextField } from '../components/FormField.tsx';
import { LinksField, type LinkValue } from '../components/LinksField.tsx';
import { SlugField } from '../components/SlugField.tsx';
import { TagsField } from '../components/TagsField.tsx';
import { useEntityForm } from '../hooks/useEntityForm.ts';
import { useSlugFromTitle } from '../hooks/useSlugFromTitle.ts';
import { EntityEdit, orNull, useGoToCreated } from './entity.tsx';

type Values = {
  id: string;
  title: string;
  categoryId: Project['categoryId'];
  summary: string;
  context: string;
  work: string;
  result: string;
  techs: string[];
  links: LinkValue[];
  captures: CaptureValue[];
  hidden: boolean;
};

const CATEGORIES = [
  { value: 'pro', label: 'Pro' },
  { value: 'ecole', label: 'École' },
  { value: 'perso', label: 'Perso' },
] as const;

const EMPTY: Values = {
  id: '', title: '', categoryId: 'perso', summary: '', context: '', work: '', result: '', techs: [], links: [], captures: [], hidden: false,
};

const fromRow = (row: Project): Values => ({
  id: row.id,
  title: row.title,
  categoryId: row.categoryId,
  summary: row.summary,
  context: row.context ?? '',
  work: row.work ?? '',
  result: row.result ?? '',
  techs: row.techs,
  links: row.links,
  captures: row.captures,
  hidden: row.hidden,
});

const withNulls = (values: Values) => ({
  ...values,
  context: orNull(values.context),
  work: orNull(values.work),
  result: orNull(values.result),
});

const ProjectFormBody = ({ initial, existingId }: { initial: Values; existingId?: string }) => {
  const goToCreated = useGoToCreated('/projets');
  const form = useEntityForm<Values, Project>({
    initial,
    schema: existingId ? updateInput(projectSchema) : createInput(projectSchema),
    toPayload: (values) => {
      if (!existingId) return withNulls(values);
      const { id: _id, ...rest } = withNulls(values);
      return rest;
    },
    save: ((payload: object) =>
      existingId ? api.put<Project>(`/admin/projects/${encodeURIComponent(existingId)}`, payload) : api.post<Project>('/admin/projects', payload)) as never,
    ...(existingId ? {} : { onSaved: goToCreated, lockWhileSaving: true }),
  });
  const { values, setField, errorFor } = form;
  const slug = useSlugFromTitle((id) => setField('id', id));

  return (
    <form className="form" onSubmit={(event) => void form.submit(event)} noValidate>
      <fieldset className="plain" disabled={form.locked}>
      <div className="form-col">
        <div className="form-row">
          <TextField
            label="Titre"
            value={values.title}
            error={errorFor('title')}
            onChange={(title) => {
              setField('title', title);
              if (!existingId) slug.onTitle(title);
            }}
          />
          <SelectField label="Catégorie" value={values.categoryId} options={CATEGORIES} error={errorFor('categoryId')} onChange={(categoryId) => setField('categoryId', categoryId)} />
        </div>
        <SlugField value={values.id} readOnly={Boolean(existingId)} error={errorFor('id')} onChange={slug.onId} />
        <TextField label="Résumé" rows={3} value={values.summary} error={errorFor('summary')} onChange={(summary) => setField('summary', summary)} />
        <TextField label="Le contexte" rows={8} value={values.context} error={errorFor('context')} hint="Pourquoi ce projet, pour qui." onChange={(context) => setField('context', context)} />
        <TextField label="Ce que j’ai fait" rows={8} value={values.work} error={errorFor('work')} hint="Tes choix, ta partie du travail." onChange={(work) => setField('work', work)} />
        <TextField label="Le résultat" rows={8} value={values.result} error={errorFor('result')} onChange={(result) => setField('result', result)} />
        <TagsField label="Technos" values={values.techs} error={errorFor('techs')} onChange={(techs) => setField('techs', techs)} />
        <CheckField label="Masquer ce projet sur les deux sites" checked={values.hidden} onChange={(hidden) => setField('hidden', hidden)} />
        <FormActions form={form} />
      </div>
      <div className="form-col">
        <CapturesPanel values={values.captures} errorFor={errorFor} onChange={(captures) => setField('captures', captures)} />
        <Group title="Liens">
          <LinksField values={values.links} errorFor={errorFor} onChange={(links) => setField('links', links)} />
        </Group>
      </div>
      </fieldset>
    </form>
  );
};

export const NewProjectPage = () => <ProjectFormBody initial={EMPTY} />;

export const EditProjectPage = () => (
  <EntityEdit<Project> path="projects">
    {(row, id) => <ProjectFormBody initial={fromRow(row)} existingId={id} />}
  </EntityEdit>
);
