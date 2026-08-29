import Modal from './Modal';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel} widthClassName="max-w-sm">
      <p className="text-sm text-neutral-600 dark:text-neutral-300">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className={`rounded-lg px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50 ${
            isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
          }`}
        >
          {isSubmitting ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
