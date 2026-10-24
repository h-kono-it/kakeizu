import { useState, useEffect } from 'react';
import type { Person, Gender, Household } from '../types';
import { isValidDate } from '../lib/dateFormat';

export interface UnionOption {
  id: string;   // '' = 親の組を作らない / 外す
  label: string;
}

// 親の組み合わせを選ぶ欄（子の追加時の「もう一人の親」、編集時の「親」）
export interface UnionField {
  label: string;
  options: UnionOption[];
  initial: string;
  hint?: string;
}

interface Props {
  title: string;
  contextLabel?: string;
  initial: Person;
  unionField?: UnionField;
  households: Household[];
  // unionField がある場合のみ、選択された UnionOption の id が渡される
  onSave: (person: Person, unionId?: string) => void;
  onClose: () => void;
}

const GENDERS: { value: Gender; label: string; cls: string }[] = [
  { value: 'male', label: '男性', cls: 'bg-sky-100 border-sky-400 text-sky-700' },
  { value: 'female', label: '女性', cls: 'bg-rose-100 border-rose-400 text-rose-700' },
  { value: 'other', label: 'その他', cls: 'bg-violet-100 border-violet-400 text-violet-700' },
  { value: 'unknown', label: '不明', cls: 'bg-gray-100 border-gray-400 text-gray-700' },
];

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';

export function PersonModal({ title, contextLabel, initial, unionField, households, onSave, onClose }: Props) {
  const [p, setP] = useState<Person>(initial);
  const [unionId, setUnionId] = useState(unionField?.initial ?? '');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = <K extends keyof Person>(key: K, value: Person[K]) => setP((prev) => ({ ...prev, [key]: value }));

  const birthError = !!p.birthDate && !isValidDate(p.birthDate);
  const deathError = !!p.deathDate && !isValidDate(p.deathDate);
  const canSave = (p.familyName.trim() || p.givenName.trim()) && !birthError && !deathError;

  const handleSubmit = () => {
    if (!canSave) return;
    onSave(
      {
        ...p,
        familyName: p.familyName.trim(),
        givenName: p.givenName.trim(),
        maidenName: p.maidenName?.trim() || undefined,
        nickname: p.nickname?.trim() || undefined,
        tagline: p.tagline?.trim() || undefined,
        householdId: p.householdId || undefined,
        birthDate: p.birthDate?.trim() || undefined,
        deathDate: p.deathDate?.trim() || undefined,
        deceased: p.deceased || !!p.deathDate?.trim(),
        note: p.note?.trim() || undefined,
      },
      unionField ? unionId : undefined,
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        className="bg-white rounded-2xl shadow-xl w-[460px] max-w-[95vw] max-h-[92vh] overflow-y-auto p-6"
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
      >
        <h2 className="text-base font-bold text-gray-800 mb-4">{title}</h2>

        {contextLabel && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800 font-medium">{contextLabel}</p>
          </div>
        )}

        {unionField && unionField.options.length > 1 && (
          <div className="mb-4">
            <label className={labelCls}>{unionField.label}</label>
            <div className="space-y-1.5">
              {unionField.options.map((o) => (
                <label
                  key={o.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                    unionId === o.id
                      ? 'bg-blue-50 border-blue-400 text-blue-800 font-medium'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    className="accent-blue-600"
                    checked={unionId === o.id}
                    onChange={() => setUnionId(o.id)}
                  />
                  {o.label}
                </label>
              ))}
            </div>
            {unionField.hint && <p className="text-[11px] text-gray-400 mt-1">{unionField.hint}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className={labelCls}>姓</label>
            <input className={inputCls} value={p.familyName} onChange={(e) => set('familyName', e.target.value)} placeholder="山田" />
          </div>
          <div>
            <label className={labelCls}>名</label>
            <input className={inputCls} value={p.givenName} onChange={(e) => set('givenName', e.target.value)} placeholder="太郎" autoFocus />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className={labelCls}>旧姓（任意）</label>
            <input className={inputCls} value={p.maidenName ?? ''} onChange={(e) => set('maidenName', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>呼び名（任意）</label>
            <input className={inputCls} value={p.nickname ?? ''} onChange={(e) => set('nickname', e.target.value)} placeholder="ばあちゃん" />
          </div>
        </div>

        <div className="mb-4">
          <label className={labelCls}>ひとこと（任意・カードに表示）</label>
          <input
            className={inputCls}
            value={p.tagline ?? ''}
            maxLength={30}
            onChange={(e) => set('tagline', e.target.value)}
            placeholder="釣りが趣味。お酒好き"
          />
        </div>

        {households.length > 0 && (
          <div className="mb-4">
            <label className={labelCls}>世帯</label>
            <select className={inputCls} value={p.householdId ?? ''} onChange={(e) => set('householdId', e.target.value || undefined)}>
              <option value="">なし</option>
              {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
        )}

        <div className="mb-4">
          <label className={labelCls}>性別</label>
          <div className="flex gap-2">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => set('gender', g.value)}
                className={`flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  p.gender === g.value ? g.cls : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-1">
          <div>
            <label className={labelCls}>生年月日</label>
            <input
              className={`${inputCls} ${birthError ? 'border-red-300 focus:ring-red-200' : ''}`}
              value={p.birthDate ?? ''}
              onChange={(e) => set('birthDate', e.target.value)}
              placeholder="1950 / 1950-04-01"
            />
          </div>
          <div>
            <label className={labelCls}>没年月日</label>
            <input
              className={`${inputCls} ${deathError ? 'border-red-300 focus:ring-red-200' : ''}`}
              value={p.deathDate ?? ''}
              onChange={(e) => set('deathDate', e.target.value)}
              placeholder="2020 / 2020-12"
            />
          </div>
        </div>
        <p className={`text-[11px] mb-3 ${birthError || deathError ? 'text-red-500' : 'text-gray-400'}`}>
          西暦で「年」「年-月」「年-月-日」のいずれかの形式で入力してください
        </p>

        <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-4 h-4 rounded accent-gray-500"
            checked={p.deceased || !!p.deathDate}
            disabled={!!p.deathDate}
            onChange={(e) => set('deceased', e.target.checked)}
          />
          <span className="text-sm text-gray-700">故人（没年不明の場合はこちらにチェック）</span>
        </label>

        <div className="mb-5">
          <label className={labelCls}>メモ（任意）</label>
          <textarea className={`${inputCls} resize-none`} rows={2} value={p.note ?? ''} onChange={(e) => set('note', e.target.value)} />
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            キャンセル
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
