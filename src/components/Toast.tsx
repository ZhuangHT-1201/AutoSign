import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastState {
  id: number;
  tone: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toast: ToastState | null;
  onClose: () => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  if (!toast) return null;
  const Icon =
    toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertCircle : Info;
  return (
    <div className={`toast toast--${toast.tone}`} role="status">
      <span className="toast__icon">
        <Icon size={19} strokeWidth={2.2} />
      </span>
      <span>{toast.message}</span>
      <button className="icon-button toast__close" onClick={onClose} aria-label="关闭提示">
        <X size={17} />
      </button>
    </div>
  );
}
