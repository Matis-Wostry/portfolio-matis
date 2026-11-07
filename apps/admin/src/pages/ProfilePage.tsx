import { useQuery } from '@tanstack/react-query';
import { profileSchema, slugify, type Profile } from '@portfolio-matis/content';
import { api, ApiError, mediaUrl } from '../api/client.ts';
import { FileInput } from '../components/FileInput.tsx';
import { FormActions } from '../components/FormActions.tsx';
import { Group, TextField } from '../components/FormField.tsx';
import { ListField } from '../components/ListField.tsx';
import { QueryState } from '../components/QueryState.tsx';
import { TagsField } from '../components/TagsField.tsx';
import { useEntityForm } from '../hooks/useEntityForm.ts';
import { orNull } from './entity.tsx';

type Values = Omit<Profile, 'about' | 'cvFile'> & { about: string; cvFile: string };

const EMPTY: Values = {
  name: '',
  role: '',
  city: '',
  about: '',
  search: { contractType: '', duration: '', start: '', location: '' },
  goals: [],
  motivations: [],
  frustrations: [],
  workStyle: [],
  softSkills: [],
  hobbies: [],
  cvFile: '',
};

const fromProfile = (profile: Profile): Values => ({ ...profile, about: profile.about ?? '', cvFile: profile.cvFile ?? '' });

const Form = ({ initial }: { initial: Values }) => {
  const form = useEntityForm<Values>({
    initial,
    schema: profileSchema,
    toPayload: (values) => ({
      ...values,
      about: orNull(values.about),
      cvFile: orNull(values.cvFile),
      // Un loisir déjà publié garde son identifiant, même si son libellé change : le site y rattache son icône.
      hobbies: values.hobbies.map((hobby) => ({ ...hobby, id: hobby.id || slugify(hobby.label) })),
    }),
    save: ((payload: object) => api.put('/admin/profile', payload)) as never,
  });
  const { values, setField, errorFor } = form;
  const setSearch = (key: keyof Values['search'], value: string) => setField('search', { ...values.search, [key]: value });

  return (
    <form className="form single" onSubmit={(event) => void form.submit(event)} noValidate>
      <div className="form-col">
        <div className="form-row">
          <TextField label="Nom" value={values.name} error={errorFor('name')} onChange={(name) => setField('name', name)} />
          <TextField label="Rôle" value={values.role} error={errorFor('role')} onChange={(role) => setField('role', role)} />
          <TextField label="Ville" value={values.city} error={errorFor('city')} onChange={(city) => setField('city', city)} />
        </div>
        <TextField label="À propos" rows={8} value={values.about} error={errorFor('about')} onChange={(about) => setField('about', about)} />

        <Group title="Recherche">
          <div className="form-row">
            <TextField label="Type de contrat" value={values.search.contractType} error={errorFor('search.contractType')} onChange={(value) => setSearch('contractType', value)} />
            <TextField label="Durée" value={values.search.duration} error={errorFor('search.duration')} onChange={(value) => setSearch('duration', value)} />
            <TextField label="Début" value={values.search.start} error={errorFor('search.start')} onChange={(value) => setSearch('start', value)} />
            <TextField label="Lieu" value={values.search.location} error={errorFor('search.location')} onChange={(value) => setSearch('location', value)} />
          </div>
        </Group>

        <ListField label="Objectifs" path="goals" values={values.goals} errorFor={errorFor} onChange={(goals) => setField('goals', goals)} />
        <ListField label="Motivations" path="motivations" values={values.motivations} errorFor={errorFor} onChange={(motivations) => setField('motivations', motivations)} />
        <ListField label="Frustrations" path="frustrations" values={values.frustrations} errorFor={errorFor} onChange={(frustrations) => setField('frustrations', frustrations)} />

        <Group title="Façons de travailler">
          <div className="rows">
            {values.workStyle.map((item, index) => {
              const update = (patch: Partial<typeof item>) =>
                setField('workStyle', values.workStyle.map((current, i) => (i === index ? { ...current, ...patch } : current)));
              return (
                <div className="row" key={index}>
                  <TextField label={`Qualité ${index + 1}`} value={item.quality} error={errorFor(`workStyle.${index}.quality`)} onChange={(quality) => update({ quality })} />
                  <TextField label={`Preuve ${index + 1}`} value={item.proof} error={errorFor(`workStyle.${index}.proof`)} onChange={(proof) => update({ proof })} />
                  <button type="button" className="btn small" aria-label={`Retirer la façon de travailler ${index + 1}`} onClick={() => setField('workStyle', values.workStyle.filter((_, i) => i !== index))}>Retirer</button>
                </div>
              );
            })}
            <div>
              <button type="button" className="btn small" onClick={() => setField('workStyle', [...values.workStyle, { quality: '', proof: '' }])}>Ajouter une façon de travailler</button>
            </div>
          </div>
        </Group>

        <TagsField label="Savoir-être" values={values.softSkills} error={errorFor('softSkills')} onChange={(softSkills) => setField('softSkills', softSkills)} />

        <Group title="Loisirs">
          <div className="rows">
            {values.hobbies.map((hobby, index) => (
              <div className="row single" key={index}>
                <TextField
                  label={`Loisir ${index + 1}`}
                  value={hobby.label}
                  error={errorFor(`hobbies.${index}.label`)}
                  onChange={(label) => setField('hobbies', values.hobbies.map((current, i) => (i === index ? { ...current, label } : current)))}
                />
                <button type="button" className="btn small" aria-label={`Retirer le loisir ${index + 1}`} onClick={() => setField('hobbies', values.hobbies.filter((_, i) => i !== index))}>Retirer</button>
              </div>
            ))}
            <div>
              <button type="button" className="btn small" onClick={() => setField('hobbies', [...values.hobbies, { id: '', label: '' }])}>Ajouter un loisir</button>
            </div>
          </div>
        </Group>

        <Group title="CV">
          {values.cvFile ? (
            <p>
              <a href={mediaUrl(values.cvFile)} target="_blank" rel="noreferrer">Voir le CV actuel</a>{' '}
              <button type="button" className="btn small" onClick={() => setField('cvFile', '')}>Retirer le CV</button>
            </p>
          ) : (
            <p className="notice">Aucun CV envoyé : chaque site garde le sien.</p>
          )}
          <FileInput label="Envoyer le CV" accept="application/pdf" onUploaded={({ file }) => setField('cvFile', file)} />
          {errorFor('cvFile') && <p className="field-error">{errorFor('cvFile')}</p>}
        </Group>

        <FormActions form={form} />
      </div>
    </form>
  );
};

export const ProfilePage = () => {
  const query = useQuery({
    queryKey: ['profile'],
    queryFn: () =>
      api.get<Profile>('/admin/profile').then(fromProfile, (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) return EMPTY;
        throw error;
      }),
  });
  return <QueryState query={query}>{(initial) => <Form initial={initial} />}</QueryState>;
};
