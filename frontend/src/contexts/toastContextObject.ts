import { createContext } from 'react';

export type ToastKind = 'success' | 'error';

export interface ToastContextValue {
  showToast: (kind: ToastKind, message: string) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);
