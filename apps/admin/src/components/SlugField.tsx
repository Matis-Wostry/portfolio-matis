import { TextField } from './FormField.tsx';

type Props = {
  value: string;
  onChange(value: string): void;
  error?: string | undefined;
  readOnly: boolean;
};

export const SlugField = ({ value, onChange, error, readOnly }: Props) => (
  <TextField
    label="Identifiant"
    value={value}
    onChange={onChange}
    error={error}
    readOnly={readOnly}
    hint={readOnly ? 'Un identifiant ne change plus après sa création.' : 'Déduit du titre. Il ne pourra plus changer ensuite.'}
  />
);
