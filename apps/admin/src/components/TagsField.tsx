import { useId, useState, type KeyboardEvent } from 'react';

type Props = {
  label: string;
  values: string[];
  onChange(values: string[]): void;
  error?: string | undefined;
};

export const TagsField = ({ label, values, onChange, error }: Props) => {
  const id = useId();
  const [draft, setDraft] = useState('');

  // Appelé aussi en quittant le champ : un mot tapé sans appuyer sur Entrée n'est pas perdu.
  const commit = () => {
    const tag = draft.trim();
    setDraft('');
    if (tag && !values.includes(tag)) onChange([...values, tag]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commit();
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="tags">
        {values.map((tag) => (
          <span key={tag} className="tag">
            {tag}
            <button type="button" aria-label={`Retirer ${tag}`} onClick={() => onChange(values.filter((value) => value !== tag))}>×</button>
          </span>
        ))}
      </div>
      <div className="tag-input">
        <input
          id={id}
          type="text"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
        />
      </div>
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
};
