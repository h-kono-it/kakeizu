import { memo } from 'react';
import { Handle, Position, NodeToolbar } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { Person, Gender, EraDisplay, Relation, Household } from '../types';
import { lifespan, ageLabel } from '../lib/dateFormat';
import { PERSON_W, PERSON_H } from '../lib/layout';

const GENDER_STYLE: Record<Gender, string> = {
  male: 'border-sky-400',
  female: 'border-rose-400',
  other: 'border-violet-400',
  unknown: 'border-gray-300',
};

export type PersonNodePayload = {
  person: Person;
  era: EraDisplay;
  selected: boolean;
  canAddParent: boolean;
  kinship?: string;
  household?: Household;
  dimmed: boolean;
  isViewpoint: boolean;
  onAdd: (id: string, relation: Relation) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSetViewpoint: (id: string | undefined) => void;
};

export type PersonNodeType = Node<PersonNodePayload, 'person'>;

const ACTIONS: { relation: Relation; label: string }[] = [
  { relation: 'parent', label: '＋親' },
  { relation: 'spouse', label: '＋配偶者' },
  { relation: 'child', label: '＋子' },
  { relation: 'sibling', label: '＋兄弟姉妹' },
];

const hiddenHandle = '!w-1 !h-1 !min-w-0 !min-h-0 !bg-transparent !border-0';
const toolBtn = 'text-xs px-2.5 py-1.5 rounded-lg transition-colors';

export const PersonNode = memo(function PersonNode({ data }: NodeProps<PersonNodeType>) {
  const { person: p } = data;
  const age = ageLabel(p);
  const sub = [p.maidenName && `旧姓 ${p.maidenName}`, lifespan(p, data.era)].filter(Boolean).join(' · ');

  return (
    <>
      <NodeToolbar isVisible={data.selected} position={Position.Bottom} offset={8}>
        <div className="flex items-center gap-1 bg-white rounded-xl shadow-lg border border-gray-200 p-1">
          {ACTIONS.map((a) => (
            <button
              key={a.relation}
              onClick={() => data.onAdd(p.id, a.relation)}
              disabled={a.relation === 'parent' && !data.canAddParent}
              title={a.relation === 'parent' && !data.canAddParent ? '親はすでに2人登録されています' : undefined}
              className={`${toolBtn} text-gray-700 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed`}
            >
              {a.label}
            </button>
          ))}
          <span className="w-px h-5 bg-gray-200 mx-0.5" />
          <button
            onClick={() => data.onSetViewpoint(data.isViewpoint ? undefined : p.id)}
            className={`${toolBtn} text-gray-700 hover:bg-gray-100`}
          >
            {data.isViewpoint ? '続柄を解除' : 'この人から見る'}
          </button>
          <button onClick={() => data.onEdit(p.id)} className={`${toolBtn} text-gray-700 hover:bg-gray-100`}>
            編集
          </button>
          <button onClick={() => data.onDelete(p.id)} className={`${toolBtn} text-red-500 hover:bg-red-50`}>
            削除
          </button>
        </div>
      </NodeToolbar>

      <Handle type="target" position={Position.Top} className={hiddenHandle} />
      <div
        style={{ width: PERSON_W, height: PERSON_H }}
        className={`
          relative overflow-hidden rounded-xl border-2 pl-4 pr-3 py-2 flex flex-col justify-center gap-0.5 cursor-pointer transition-all
          ${GENDER_STYLE[p.gender]}
          ${p.deceased || p.deathDate ? 'bg-gray-50' : 'bg-white'}
          ${data.selected ? 'ring-4 ring-blue-200 shadow-md' : 'shadow-sm hover:shadow-md'}
          ${data.isViewpoint ? 'ring-4 ring-amber-300' : ''}
          ${data.dimmed ? 'opacity-25' : ''}
        `}
      >
        {data.household && (
          <span
            className="absolute left-0 top-0 bottom-0 w-1.5"
            style={{ backgroundColor: data.household.color }}
            title={data.household.name}
          />
        )}

        <div className="flex items-center gap-1.5 min-h-4 text-[11px] leading-tight">
          {data.kinship && (
            <span className={`shrink-0 px-1.5 rounded font-bold ${
              data.isViewpoint ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'
            }`}>
              {data.kinship}
            </span>
          )}
          {p.nickname && <span className="text-gray-600 truncate">「{p.nickname}」</span>}
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-bold text-gray-800 truncate leading-tight">
            {p.familyName} {p.givenName}
            {!p.familyName && !p.givenName && <span className="text-gray-400 font-normal">（名前未入力）</span>}
          </p>
          {age && <span className="shrink-0 text-[11px] text-gray-500">{age}</span>}
        </div>

        <p className="text-[11px] text-gray-500 truncate leading-tight min-h-[1em]">{sub}</p>
        <p className="text-[11px] text-gray-500 truncate leading-tight min-h-[1em]">{p.tagline}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className={hiddenHandle} />
    </>
  );
});
