import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: { id: string; type: string; title: string; message?: string; duration?: number };
  onRemove: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onRemove, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast.duration, onRemove]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success" />,
    error: <AlertCircle className="w-5 h-5 text-danger" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning" />,
    info: <Info className="w-5 h-5 text-info" />,
  };

  const borderColors = {
    success: 'border-l-success',
    error: 'border-l-danger',
    warning: 'border-l-warning',
    info: 'border-l-info',
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-lg border border-border border-l-4 ${
        borderColors[toast.type as keyof typeof borderColors] || 'border-l-info'
      } p-3 min-w-[300px] max-w-sm flex items-start gap-2 animate-in slide-in-from-right`}
    >
      {icons[toast.type as keyof typeof icons] || icons.info}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.message && <p className="text-xs text-text-secondary mt-0.5">{toast.message}</p>}
      </div>
      <button onClick={onRemove} className="p-0.5 hover:bg-gray-100 rounded transition-colors">
        <X className="w-3.5 h-3.5 text-text-muted" />
      </button>
    </div>
  );
}
