// ============================================================================
// 토스트 알림 컴포넌트
// ============================================================================
'use client';

import { useState, useCallback, useEffect, createContext, useContext } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'kakao';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const typeStyles: Record<ToastType, string> = {
  success: 'border-l-4 border-l-green-500',
  error: 'border-l-4 border-l-red-500',
  info: 'border-l-4 border-l-blue-500',
  kakao: 'border-l-4 border-l-yellow-400',
};

const typeIcons: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  kakao: '💬',
};

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* 토스트 컨테이너 */}
      <div className="fixed top-[70px] right-4 z-[300] flex flex-col gap-1.5">
        {toasts.map((t) => (
          <ToastMessage key={t.id} item={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastMessage({
  item,
  onRemove,
}: {
  item: ToastItem;
  onRemove: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(item.id), 3000);
    return () => clearTimeout(timer);
  }, [item.id, onRemove]);

  return (
    <div
      className={`bg-white rounded-xl px-4 py-3 shadow-lg flex items-center gap-2 text-xs font-semibold min-w-[260px] animate-slide-in ${typeStyles[item.type]}`}
    >
      <span>{typeIcons[item.type]}</span>
      <span>{item.message}</span>
    </div>
  );
}
