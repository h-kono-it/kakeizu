import { useState, useEffect } from 'react';
import type { Household, Person } from '../types';
import { fullName, HOUSEHOLD_COLORS } from '../lib/treeOps';

interface Props {
  household: Household;
  isNew: boolean;
  persons: Person[];
  households: Household[];
  onSave: (household: Household, memberIds: Set<string>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';

export function HouseholdModal({ household, isNew, persons, households, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(household.name);
  const [color, setColor] = useState(household.color);
  const [members, setMembers] = useState(
    () => new Set(persons.filter((p) => p.householdId === household.id).map((p) => p.id)),
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const toggle = (id: string) => setMembers((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const otherHousehold = (p: Person) =>
    p.householdId && p.householdId !== household.id ? households.find((h) => h.id === p.householdId) : undefined;

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({ ...household, name: name.trim(), color }, members);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        className="bg-white rounded-2xl shadow-xl w-[420px] max-w-[95vw] max-h-[92vh] flex flex-col p-6"
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
      >
        <h2 className="text-base font-bold text-gray-800 mb-4">{isNew ? '世帯を追加' : '世帯を編集'}</h2>

        <div className="mb-4">
          <label className={labelCls}>世帯の名前</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="例：実家、兄一家" autoFocus />
        </div>

        <div className="mb-4">
          <label className={labelCls}>色</label>
          <div className="flex gap-2">
            {HOUSEHOLD_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <label className={labelCls}>一緒に暮らしている人（{members.size}人）</label>
        <div className="flex-1 min-h-0 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 mb-5 max-h-64">
          {persons.map((p) => {
            const other = otherHousehold(p);
            return (
              <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" className="accent-blue-600" checked={members.has(p.id)} onChange={() => toggle(p.id)} />
                <span className="flex-1 truncate">{fullName(p)}</span>
                {other && (
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: other.color }} />
                    {members.has(p.id) ? `${other.name}から移動` : other.name}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        <div className="flex gap-2 items-center">
          {!isNew && (
            <button
              type="button"
              onClick={() => { onDelete(household.id); onClose(); }}
              className="px-3 py-2 text-sm text-red-500 rounded-lg hover:bg-red-50 transition-colors"
            >
              世帯を削除
            </button>
          )}
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            キャンセル
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
