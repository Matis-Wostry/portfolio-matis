import { useQuery } from '@tanstack/react-query';
import { contactSchema, type Contact } from '@portfolio-matis/content';
import { api, ApiError } from '../api/client.ts';
import { FormActions } from '../components/FormActions.tsx';
import { Group, TextField } from '../components/FormField.tsx';
import { LinksField } from '../components/LinksField.tsx';
import { QueryState } from '../components/QueryState.tsx';
import { useEntityForm } from '../hooks/useEntityForm.ts';

const EMPTY: Contact = { email: '', phone: '', links: [] };

const Form = ({ initial }: { initial: Contact }) => {
  const form = useEntityForm<Contact>({
    initial,
    schema: contactSchema,
    save: (payload) => api.put('/admin/contact', payload),
  });
  const { values, setField, errorFor } = form;
  return (
    <form className="form full" onSubmit={(event) => void form.submit(event)} noValidate>
      <div className="form-col">
        <div className="form-row">
          <TextField label="Email" value={values.email} error={errorFor('email')} onChange={(email) => setField('email', email)} />
          <TextField label="Téléphone" value={values.phone} error={errorFor('phone')} onChange={(phone) => setField('phone', phone)} />
        </div>
        <Group title="Liens">
          <LinksField values={values.links} errorFor={errorFor} onChange={(links) => setField('links', links)} />
        </Group>
        <FormActions form={form} />
      </div>
    </form>
  );
};

export const ContactPage = () => {
  const query = useQuery({
    queryKey: ['contact'],
    queryFn: () =>
      api.get<Contact>('/admin/contact').catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) return EMPTY;
        throw error;
      }),
  });
  return <QueryState query={query}>{(initial) => <Form initial={initial} />}</QueryState>;
};
