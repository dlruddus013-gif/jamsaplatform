// ============================================================================
// 공통 모달 컴포넌트
// ============================================================================
'use client';

import { useEffect, useCallback } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = '560px',
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl w-full overflow-hidden shadow-2xl max-h-[85vh] flex flex-col"
        style={{ maxWidth }}
      >
        {/* 헤더 */}
        <div className="px-6 py-5 border-b border-museum-border flex justify-between items-center">
          <h3 className="text-base font-extrabold text-museum-primary">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-xl text-gray-400 hover:text-gray-600 transition-colors"
          >
            &times;
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

        {/* 푸터 */}
        {footer && (
          <div className="px-6 py-3 flex justify-end gap-2 border-t border-museum-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
