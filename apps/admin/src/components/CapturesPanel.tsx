import { mediaUrl } from '../api/client.ts';
import { FileInput } from './FileInput.tsx';
import { Group, TextField } from './FormField.tsx';

export type CaptureValue = { file: string; alt: string };

type Props = {
  values: CaptureValue[];
  onChange(values: CaptureValue[]): void;
  errorFor(path: string): string | undefined;
};

export const CapturesPanel = ({ values, onChange, errorFor }: Props) => (
  <Group title="Captures">
    <div className="shots">
      {values.map((capture, index) => (
        <div className="shot" key={capture.file}>
          <img src={mediaUrl(capture.file)} alt={capture.alt} />
          <TextField
            label={`Texte alternatif de la capture ${index + 1}`}
            value={capture.alt}
            error={errorFor(`captures.${index}.alt`)}
            onChange={(alt) => onChange(values.map((current, i) => (i === index ? { ...current, alt } : current)))}
          />
          <div>
            <button type="button" className="btn small" aria-label={`Retirer la capture ${index + 1}`} onClick={() => onChange(values.filter((_, i) => i !== index))}>Retirer</button>
          </div>
        </div>
      ))}
    </div>
    <FileInput
      label="Ajouter une capture"
      accept="image/png,image/jpeg,image/webp"
      onUploaded={({ file }) => onChange([...values, { file, alt: '' }])}
    />
  </Group>
);
