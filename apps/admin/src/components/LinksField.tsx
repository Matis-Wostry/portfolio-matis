import { TextField } from './FormField.tsx';

export type LinkValue = { label: string; href: string };

type Props = {
  values: LinkValue[];
  onChange(values: LinkValue[]): void;
  errorFor(path: string): string | undefined;
};

export const LinksField = ({ values, onChange, errorFor }: Props) => {
  const update = (index: number, patch: Partial<LinkValue>) =>
    onChange(values.map((link, i) => (i === index ? { ...link, ...patch } : link)));

  return (
    <div className="rows">
      {values.map((link, index) => (
        <div className="rows" key={index}>
          <TextField label={`Libellé du lien ${index + 1}`} value={link.label} error={errorFor(`links.${index}.label`)} onChange={(label) => update(index, { label })} />
          <TextField label={`Adresse du lien ${index + 1}`} value={link.href} error={errorFor(`links.${index}.href`)} onChange={(href) => update(index, { href })} />
          <div>
            <button type="button" className="btn small" aria-label={`Retirer le lien ${index + 1}`} onClick={() => onChange(values.filter((_, i) => i !== index))}>Retirer</button>
          </div>
        </div>
      ))}
      <div>
        <button type="button" className="btn small" onClick={() => onChange([...values, { label: '', href: '' }])}>Ajouter un lien</button>
      </div>
    </div>
  );
};
