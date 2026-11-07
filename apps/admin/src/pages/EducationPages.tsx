import { educationSchema, updateInput, type Education } from '@portfolio-matis/content';
import { api } from '../api/client.ts';
import { EntityList } from '../components/EntityList.tsx';
import { FormActions } from '../components/FormActions.tsx';
import { TextField } from '../components/FormField.tsx';
import { ListField } from '../components/ListField.tsx';
import { SlugField } from '../components/SlugField.tsx';
import { useEntityForm } from '../hooks/useEntityForm.ts';
import { useSlugFromTitle } from '../hooks/useSlugFromTitle.ts';
import { creationSchema, EntityEdit, orNull, useGoToCreated } from './entity.tsx';

type Values = { id: string; degree: string; school: string; start: string; end: string; details: string[] };

const EMPTY: Values = { id: '', degree: '', school: '', start: '', end: '', details: [] };

const fromRow = (row: Education): Values => ({
  id: row.id,
  degree: row.degree,
  school: row.school,
  start: row.start,
  end: row.end ?? '',
  details: row.details,
});

const Form = ({ initial, existingId }: { initial: Values; existingId?: string }) => {
  const goToCreated = useGoToCreated('/formations');
  const form = useEntityForm<Values, Education>({
    initial,
    schema: existingId ? updateInput(educationSchema) : creationSchema(educationSchema),
    toPayload: ({ id, ...values }) => ({ ...(existingId ? {} : { id }), ...values, end: orNull(values.end) }),
    save: (payload) =>
      existingId ? api.put<Education>(`/admin/educations/${encodeURIComponent(existingId)}`, payload) : api.post<Education>('/admin/educations', payload),
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
            label="Diplôme"
            value={values.degree}
            error={errorFor('degree')}
            onChange={(degree) => {
              setField('degree', degree);
              if (!existingId) slug.onTitle(degree);
            }}
          />
          <TextField label="École" value={values.school} error={errorFor('school')} onChange={(school) => setField('school', school)} />
        </div>
        <SlugField value={values.id} readOnly={Boolean(existingId)} error={errorFor('id')} onChange={slug.onId} />
        <div className="form-row">
          <TextField label="Début" value={values.start} error={errorFor('start')} hint="AAAA ou AAAA-MM" onChange={(start) => setField('start', start)} />
          <TextField label="Fin" value={values.end} error={errorFor('end')} hint="Vide si en cours" onChange={(end) => setField('end', end)} />
        </div>
        <ListField label="Détails" path="details" values={values.details} errorFor={errorFor} onChange={(details) => setField('details', details)} />
        <FormActions form={form} />
      </div>
      </fieldset>
    </form>
  );
};

export const EducationsPage = () => (
  <EntityList<Education>
    title="Formations"
    path="educations"
    basePath="/formations"
    primary={(row) => row.degree}
    meta={(row) => `${row.school} · ${row.start} à ${row.end ?? 'aujourd’hui'}`}
  />
);

export const NewEducationPage = () => <Form initial={EMPTY} />;

export const EditEducationPage = () => (
  <EntityEdit<Education> path="educations">{(row, id) => <Form initial={fromRow(row)} existingId={id} />}</EntityEdit>
);
