import type { Household, Person } from '../types';

interface Props {
  households: Household[];
  persons: Person[];
  highlightId: string | null;
  onHighlight: (id: string | null) => void;
  onEdit: (id: string) => void;
  onAdd: () => void;
}

export function HouseholdPanel({ households, persons, highlightId, onHighlight, onEdit, onAdd }: Props) {
  const count = (id: string) => persons.filter((p) => p.householdId === id).length;

  return (
    <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm p-2 w-52">
      <p className="text-[11px] font-semibold text-gray-500 px-1.5 mb-1">世帯</p>
      {households.map((h) => (
        <div
          key={h.id}
          className={`group flex items-center gap-2 px-1.5 py-1 rounded-lg cursor-pointer transition-colors ${
            highlightId === h.id ? 'bg-gray-100' : 'hover:bg-gray-50'
          }`}
          onClick={() => onHighlight(highlightId === h.id ? null : h.id)}
          title="クリックでこの世帯を強調"
        >
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
          <span className="flex-1 text-xs text-gray-700 truncate">{h.name}</span>
          <span className="text-[11px] text-gray-400">{count(h.id)}人</span>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(h.id); }}
            className="text-[11px] text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            編集
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="w-full text-left text-xs text-blue-600 px-1.5 py-1 rounded-lg hover:bg-blue-50 transition-colors"
      >
        ＋ 世帯を追加
      </button>
    </div>
  );
}
