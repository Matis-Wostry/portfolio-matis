import { useId, type ReactNode } from 'react';

type Common = { label: string; error?: string | undefined; hint?: string };

/** Les identifiants des textes qui décrivent un champ, lus avec lui par les lecteurs d'écran. */
const describedBy = (id: string, error: string | undefined, hint: string | undefined): string | undefined =>
  [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

const Message = ({ id, error, hint }: { id: string; error?: string | undefined; hint?: string | undefined }) => (
  <>
    {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
    {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
  </>
);

type TextProps = Common & {
  value: string;
  onChange(value: string): void;
  readOnly?: boolean;
  /** Une zone de plusieurs lignes, de cette hauteur. */
  rows?: number;
  /** Le libellé reste lu par les lecteurs d'écran, sans s'afficher : le titre de la liste suffit à l'œil. */
  hideLabel?: boolean;
};

const textareaClass = (rows: number): string | undefined => {
  if (rows <= 2) return 'compact';
  return rows < 8 ? 'short' : undefined;
};

export const TextField = ({ label, value, onChange, error, hint, readOnly, rows, hideLabel }: TextProps) => {
  const id = useId();
  const shared = {
    id,
    value,
    readOnly,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy(id, error, hint),
  } as const;
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>{label}</label>
      {rows ? (
        <textarea {...shared} rows={rows} className={textareaClass(rows)} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...shared} type="text" onChange={(event) => onChange(event.target.value)} />
      )}
      <Message id={id} error={error} hint={hint} />
    </div>
  );
};

type SelectProps<T extends string> = Common & {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange(value: T): void;
  /** Le texte affiché tant que rien n'est choisi ; il ne peut pas être choisi ensuite. */
  placeholder?: string;
};

export const SelectField = <T extends string>({ label, value, options, onChange, error, placeholder }: SelectProps<T>) => {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, undefined)} onChange={(event) => onChange(event.target.value as T)}>
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <Message id={id} error={error} />
    </div>
  );
};

export const CheckField = ({ label, checked, onChange }: { label: string; checked: boolean; onChange(checked: boolean): void }) => {
  const id = useId();
  return (
    <div className="field check">
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
};

export const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="panel" aria-label={title}>
    <h3>{title}</h3>
    <div className="form-col">{children}</div>
  </section>
);
