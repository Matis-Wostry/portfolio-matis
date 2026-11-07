import { experienceSchema, updateInput, type Experience } from '@portfolio-matis/content';
import { api } from '../api/client.ts';
import { EntityList } from '../components/EntityList.tsx';
import { FormActions } from '../components/FormActions.tsx';
import { SelectField, TextField } from '../components/FormField.tsx';
import { ListField } from '../components/ListField.tsx';
import { SlugField } from '../components/SlugField.tsx';
import { TagsField } from '../components/TagsField.tsx';
import { useEntityForm } from '../hooks/useEntityForm.ts';
import { useSlugFromTitle } from '../hooks/useSlugFromTitle.ts';
import { creationSchema, EntityEdit, orNull, useGoToCreated } from './entity.tsx';

type Values = {
  id: string;
  title: string;
  company: string;
  kind: Experience['kind'];
  start: string;
  end: string;
  summary: string;
  missions: string[];
  techs: string[];
};

const KINDS = [
  { value: 'pro', label: 'Poste' },
  { value: 'alternance', label: 'Alternance' },
  { value: 'stage', label: 'Stage' },
  { value: 'freelance', label: 'Freelance' },
] as const;

const EMPTY: Values = { id: '', title: '', company: '', kind: 'pro', start: '', end: '', summary: '', missions: [], techs: [] };

const fromRow = (row: Experience): Values => ({
  id: row.id,
  title: row.title,
  company: row.company,
  kind: row.kind,
  start: row.start,
  end: row.end ?? '',
  summary: row.summary ?? '',
  missions: row.missions,
  techs: row.techs,
});

const Form = ({ initial, existingId }: { initial: Values; existingId?: string }) => {
  const goToCreated = useGoToCreated('/experiences');
  const form = useEntityForm<Values, Experience>({
    initial,
    schema: existingId ? updateInput(experienceSchema) : creationSchema(experienceSchema),
    toPayload: ({ id, ...values }) => ({
      ...(existingId ? {} : { id }),
      ...values,
      end: orNull(values.end),
      summary: orNull(values.summary),
    }),
    save: (payload) =>
      existingId ? api.put<Experience>(`/admin/experiences/${encodeURIComponent(existingId)}`, payload) : api.post<Experience>('/admin/experiences', payload),
    ...(existingId ? {} : { onSaved: goToCreated, lockWhileSaving: true }),
  });
  const { values, setField, errorFor } = form;
  const slug = useSlugFromTitle((id) => setField('id', id));

  return (
    <form className="form single" onSubmit={(event) => void form.submit(event)} noValidate>
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
          <TextField label="Entreprise" value={values.company} error={errorFor('company')} onChange={(company) => setField('company', company)} />
        </div>
        <SlugField value={values.id} readOnly={Boolean(existingId)} error={errorFor('id')} onChange={slug.onId} />
        <div className="form-row">
          <SelectField label="Type" value={values.kind} options={KINDS} error={errorFor('kind')} onChange={(kind) => setField('kind', kind)} />
          <TextField label="Début" value={values.start} error={errorFor('start')} hint="AAAA ou AAAA-MM" onChange={(start) => setField('start', start)} />
          <TextField label="Fin" value={values.end} error={errorFor('end')} hint="Vide si en cours" onChange={(end) => setField('end', end)} />
        </div>
        <TextField label="Résumé" rows={3} value={values.summary} error={errorFor('summary')} onChange={(summary) => setField('summary', summary)} />
        <ListField label="Missions" path="missions" values={values.missions} errorFor={errorFor} onChange={(missions) => setField('missions', missions)} />
        <TagsField label="Technos" values={values.techs} error={errorFor('techs')} onChange={(techs) => setField('techs', techs)} />
        <FormActions form={form} />
      </div>
      </fieldset>
    </form>
  );
};

export const ExperiencesPage = () => (
  <EntityList<Experience>
    title="Expériences"
    path="experiences"
    basePath="/experiences"
    primary={(row) => row.title}
    meta={(row) => `${row.company} · ${row.start} à ${row.end ?? 'aujourd’hui'}`}
  />
);

export const NewExperiencePage = () => <Form initial={EMPTY} />;

export const EditExperiencePage = () => (
  <EntityEdit<Experience> path="experiences">{(row, id) => <Form initial={fromRow(row)} existingId={id} />}</EntityEdit>
);
