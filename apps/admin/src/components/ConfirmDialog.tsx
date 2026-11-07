import type { ReactNode } from 'react';
import { Dialog } from './Dialog.tsx';

type Props = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm(): void;
  onCancel(): void;
};

export const ConfirmDialog = ({ title, children, confirmLabel, cancelLabel = 'Annuler', busy = false, onConfirm, onCancel }: Props) => (
  <Dialog title={title} onClose={onCancel}>
    <div>{children}</div>
    <div className="dialog-actions">
      <button type="button" className="btn" onClick={onCancel} disabled={busy} autoFocus>{cancelLabel}</button>
      <button type="button" className="btn primary" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
    </div>
  </Dialog>
);
