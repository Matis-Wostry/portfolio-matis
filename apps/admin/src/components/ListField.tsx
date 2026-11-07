import { TextField } from './FormField.tsx';

type Props = {
  label: string;
  path: string;
  values: string[];
  onChange(values: string[]): void;
  errorFor(path: string): string | undefined;
};

/** Une liste de phrases : chaque ligne se modifie et se retire. */
export const ListField = ({ label, path, values, onChange, errorFor }: Props) => (
  <div className="field">
    <span className="label">{label}</span>
    <div className="rows">
      {values.map((value, index) => (
        <div className="row single" key={index}>
          <TextField
            label={`${label} ${index + 1}`}
            value={value}
            error={errorFor(`${path}.${index}`)}
            onChange={(next) => onChange(values.map((current, i) => (i === index ? next : current)))}
          />
          <button type="button" className="btn small" aria-label={`Retirer ${label} ${index + 1}`} onClick={() => onChange(values.filter((_, i) => i !== index))}>Retirer</button>
        </div>
      ))}
    </div>
    <div className="tag-input">
      <button type="button" className="btn small" aria-label={`Ajouter dans ${label}`} onClick={() => onChange([...values, ''])}>Ajouter</button>
    </div>
  </div>
);
