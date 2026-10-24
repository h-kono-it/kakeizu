import { useEffect } from 'react';
import type { Union } from '../types';

interface Props {
  union: Union;
  partnerNames: string;
  onChange: (union: Union) => void;
  onClose: () => void;
}

export function UnionModal({ union, partnerNames, onChange, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const options = [
    { divorced: false, label: '婚姻中・死別' },
    { divorced: true, label: '離別' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-[380px] max-w-[95vw] p-6">
        <h2 className="text-base font-bold text-gray-800 mb-1">関係を編集</h2>
        <p className="text-sm text-gray-500 mb-4">{partnerNames}</p>
        <div className="flex gap-2 mb-5">
          {options.map((o) => (
            <button
              key={o.label}
              onClick={() => onChange({ ...union, divorced: o.divorced || undefined })}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                !!union.divorced === o.divorced
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
