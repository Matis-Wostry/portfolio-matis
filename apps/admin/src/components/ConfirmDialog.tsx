import { useId, type ReactNode } from 'react';

type Props = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm(): void;
  onCancel(): void;
};

export const ConfirmDialog = ({ title, children, confirmLabel, cancelLabel = 'Annuler', busy = false, onConfirm, onCancel }: Props) => {
  const titleId = useId();
  return (
    <div className="overlay">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        <div>{children}</div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy} autoFocus>{cancelLabel}</button>
          <button type="button" className="btn primary" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};
