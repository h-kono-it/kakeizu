import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { FamilyTree, Gender, Household, Person, Relation } from '../types';
import { storage } from '../lib/storage';
import { layoutTree, PERSON_W, PERSON_H, UNION_SIZE, type Position } from '../lib/layout';
import {
  addRelative, removePerson, updatePerson, updateUnion,
  parentUnionOf, unionsAsPartner, canAddParent, fullName,
  parentUnionCandidates, setParentUnion, unionLabel,
  saveHousehold, removeHousehold, setHouseholdMembers, HOUSEHOLD_COLORS,
} from '../lib/treeOps';
import { kinshipTerms } from '../lib/kinship';
import { exportToJSON } from '../lib/transfer';
import { exportToPng } from '../lib/imageExport';
import { PersonNode, type PersonNodePayload } from './PersonNode';
import { UnionNode, type UnionNodePayload } from './UnionNode';
import { PersonModal, type UnionField } from './PersonModal';
import { UnionModal } from './UnionModal';
import { FamilyEdge, type FamilyEdgeType } from './FamilyEdge';
import { HouseholdPanel } from './HouseholdPanel';
import { HouseholdModal } from './HouseholdModal';

const nodeTypes = { person: PersonNode, union: UnionNode };
const edgeTypes = { family: FamilyEdge };

const RELATION_LABEL: Record<Relation, string> = {
  parent: '親',
  spouse: '配偶者',
  child: '子',
  sibling: '兄弟姉妹',
};

type ModalState =
  | { kind: 'edit'; personId: string }
  | { kind: 'add'; baseId: string; relation: Relation }
  | { kind: 'union'; unionId: string }
  | { kind: 'household'; household: Household; isNew: boolean }
  | null;

const opposite = (g: Gender): Gender => (g === 'male' ? 'female' : g === 'female' ? 'male' : 'unknown');

interface Props {
  tree: FamilyTree;
  onBack: () => void;
}

export function TreeEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <TreeEditorInner {...props} />
    </ReactFlowProvider>
  );
}

function TreeEditorInner({ tree: initialTree, onBack }: Props) {
  const [tree, setTree] = useState<FamilyTree>(initialTree);
  const [positions, setPositions] = useState<Map<string, Position>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [exporting, setExporting] = useState(false);
  const [highlightHouseholdId, setHighlightHouseholdId] = useState<string | null>(null);
  // ドラッグ中の横位置。離した時点で tree（Person.layoutX）に確定する
  const [dragging, setDragging] = useState<{ id: string; x: number } | null>(null);
  const { fitView } = useReactFlow();
  const fittedRef = useRef(false);

  useEffect(() => {
    storage.save({ ...tree, updatedAt: new Date().toISOString() });
  }, [tree]);

  // ELK は非同期なので、古い結果で上書きしないようにキャンセルする
  useEffect(() => {
    let cancelled = false;
    layoutTree(tree).then((pos) => {
      if (cancelled) return;
      setPositions(pos);
      if (!fittedRef.current) {
        fittedRef.current = true;
        requestAnimationFrame(() => fitView({ padding: 0.2, maxZoom: 1 }));
      }
    });
    return () => { cancelled = true; };
  }, [tree, fitView]);

  // confirm は updater の外で呼ぶ（StrictMode では updater が2回実行されるため）
  const handleDelete = useCallback((id: string) => {
    const p = tree.persons.find((x) => x.id === id);
    if (!p || !confirm(`${fullName(p)} を削除しますか？`)) return;
    setTree((prev) => removePerson(prev, id));
    setSelectedId(null);
  }, [tree.persons]);

  const handleAdd = useCallback((baseId: string, relation: Relation) => setModal({ kind: 'add', baseId, relation }), []);
  const handleEdit = useCallback((personId: string) => setModal({ kind: 'edit', personId }), []);
  const handleSetViewpoint = useCallback((id: string | undefined) => setTree((prev) => ({ ...prev, viewpointId: id })), []);

  const { persons, unions, viewpointId } = tree;
  const kinship = useMemo(
    () => (viewpointId ? kinshipTerms({ persons, unions }, viewpointId) : null),
    [persons, unions, viewpointId],
  );
  const householdById = useMemo(() => new Map(tree.households.map((h) => [h.id, h])), [tree.households]);

  // 自動レイアウトの座標に、手動調整した横位置を重ねる（縦＝世代は動かさない）
  const resolvedPositions = useMemo(() => {
    const pos = new Map(positions);
    for (const p of tree.persons) {
      const auto = positions.get(p.id);
      if (!auto) continue;
      const x = dragging?.id === p.id ? dragging.x : p.layoutX;
      if (x !== undefined) pos.set(p.id, { x, y: auto.y });
    }
    // 夫婦ノードは配偶者の中間に追従させる
    for (const u of tree.unions) {
      const auto = positions.get(u.id);
      const partnerPos = u.partners.map((id) => pos.get(id));
      if (!auto || partnerPos.length === 0 || partnerPos.some((q) => !q)) continue;
      const centerX = partnerPos.reduce((sum, q) => sum + q!.x + PERSON_W / 2, 0) / partnerPos.length;
      pos.set(u.id, { x: centerX - UNION_SIZE / 2, y: auto.y });
    }
    return pos;
  }, [positions, tree.persons, tree.unions, dragging]);

  // updater 内で setTree を呼ばないよう、ドラッグ中の値は ref にも持つ
  const draggingRef = useRef<{ id: string; x: number } | null>(null);
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    for (const c of changes) {
      if (c.type !== 'position') continue;
      if (c.dragging && c.position) {
        draggingRef.current = { id: c.id, x: Math.round(c.position.x) };
        setDragging(draggingRef.current);
      } else if (c.dragging === false) {
        const cur = draggingRef.current;
        draggingRef.current = null;
        setDragging(null);
        if (cur?.id === c.id) {
          setTree((prev) => ({ ...prev, persons: prev.persons.map((p) => (p.id === cur.id ? { ...p, layoutX: cur.x } : p)) }));
        }
      }
    }
  }, []);

  const hasManualLayout = tree.persons.some((p) => p.layoutX !== undefined);
  const handleResetLayout = () => {
    if (!confirm('手動で動かした位置をすべて自動レイアウトに戻しますか？')) return;
    setTree((prev) => ({ ...prev, persons: prev.persons.map((p) => ({ ...p, layoutX: undefined })) }));
  };

  const nodes = useMemo<Node[]>(() => {
    const personNodes: Node<PersonNodePayload>[] = tree.persons
      .filter((p) => resolvedPositions.has(p.id))
      .map((p) => ({
        id: p.id,
        type: 'person',
        position: resolvedPositions.get(p.id)!,
        width: PERSON_W,
        height: PERSON_H,
        data: {
          person: p,
          era: tree.eraDisplay,
          selected: p.id === selectedId,
          canAddParent: canAddParent(tree, p.id),
          kinship: kinship?.get(p.id),
          household: p.householdId ? householdById.get(p.householdId) : undefined,
          dimmed: highlightHouseholdId !== null && p.householdId !== highlightHouseholdId,
          isViewpoint: p.id === tree.viewpointId,
          onAdd: handleAdd,
          onEdit: handleEdit,
          onDelete: handleDelete,
          onSetViewpoint: handleSetViewpoint,
        },
      }));
    const unionNodes: Node<UnionNodePayload>[] = tree.unions
      .filter((u) => resolvedPositions.has(u.id))
      .map((u) => ({
        id: u.id,
        type: 'union',
        draggable: false,
        position: resolvedPositions.get(u.id)!,
        width: UNION_SIZE,
        height: UNION_SIZE,
        data: { divorced: !!u.divorced, hasPartners: u.partners.length > 0 },
      }));
    return [...personNodes, ...unionNodes];
  }, [tree, resolvedPositions, selectedId, kinship, householdById, highlightHouseholdId, handleAdd, handleEdit, handleDelete, handleSetViewpoint]);

  const edges = useMemo<FamilyEdgeType[]>(() => tree.unions.flatMap((u) => {
    const partnerStyle = { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: u.divorced ? '5 4' : undefined };
    const childStyle = { stroke: '#94a3b8', strokeWidth: 1.5 };
    return [
      ...u.partners.map((pid): FamilyEdgeType => ({ id: `${pid}>${u.id}`, source: pid, target: u.id, type: 'family', data: { kind: 'partner' }, style: partnerStyle })),
      ...u.children.map((cid): FamilyEdgeType => ({ id: `${u.id}>${cid}`, source: u.id, target: cid, type: 'family', data: { kind: 'child' }, style: childStyle })),
    ];
  }), [tree.unions]);

  // ---- モーダル ----
  const modalProps = useMemo(() => {
    if (modal?.kind === 'edit') {
      const p = tree.persons.find((x) => x.id === modal.personId);
      if (!p) return null;
      const unionField: UnionField = {
        label: '親',
        options: [
          ...parentUnionCandidates(tree, p.id).map((u) => ({ id: u.id, label: unionLabel(tree, u) })),
          { id: '', label: '登録しない' },
        ],
        initial: parentUnionOf(tree, p.id)?.id ?? '',
        hint: '変更すると兄弟姉妹の関係も変わります',
      };
      return { title: '人物を編集', initial: p, unionField };
    }
    if (modal?.kind === 'add') {
      const base = tree.persons.find((x) => x.id === modal.baseId);
      if (!base) return null;

      let gender: Gender = 'unknown';
      if (modal.relation === 'spouse') gender = opposite(base.gender);
      if (modal.relation === 'parent') {
        const other = parentUnionOf(tree, base.id)?.partners[0];
        const otherP = tree.persons.find((x) => x.id === other);
        if (otherP) gender = opposite(otherP.gender);
      }

      let unionField: UnionField | undefined;
      if (modal.relation === 'child') {
        const unions = unionsAsPartner(tree, base.id);
        const options = unions.map((u) => {
          const other = tree.persons.find((x) => u.partners.includes(x.id) && x.id !== base.id);
          return { id: u.id, label: other ? `${fullName(other)} との子${u.divorced ? '（離別）' : ''}` : '相手未登録' };
        });
        if (!unions.some((u) => u.partners.length === 1)) options.push({ id: '', label: '相手を登録せずに追加' });
        // 既定は離別していない一番新しい配偶者との子
        const current = [...unions].reverse().find((u) => !u.divorced) ?? unions.at(-1);
        unionField = { label: 'もう一人の親', options, initial: current?.id ?? '' };
      }

      const initial: Person = {
        id: crypto.randomUUID(),
        familyName: base.familyName,
        givenName: '',
        gender,
        deceased: false,
      };
      return {
        title: `${RELATION_LABEL[modal.relation]}を追加`,
        contextLabel: `${fullName(base)} の${RELATION_LABEL[modal.relation]}`,
        initial,
        unionField,
      };
    }
    return null;
  }, [modal, tree]);

  const handleSavePerson = (person: Person, unionId?: string) => {
    if (modal?.kind === 'edit') {
      setTree((prev) => {
        const updated = updatePerson(prev, person);
        const current = parentUnionOf(prev, person.id)?.id ?? '';
        return unionId === undefined || unionId === current
          ? updated
          : setParentUnion(updated, person.id, unionId || null);
      });
    } else if (modal?.kind === 'add') {
      setTree((prev) => addRelative(prev, modal.baseId, modal.relation, person, unionId || undefined));
      setSelectedId(person.id);
    }
  };

  const modalUnion = modal?.kind === 'union' ? tree.unions.find((u) => u.id === modal.unionId) : undefined;

  const openNewHousehold = () => setModal({
    kind: 'household',
    isNew: true,
    household: {
      id: crypto.randomUUID(),
      name: '',
      color: HOUSEHOLD_COLORS[tree.households.length % HOUSEHOLD_COLORS.length],
    },
  });

  const openHousehold = (id: string) => {
    const household = householdById.get(id);
    if (household) setModal({ kind: 'household', isNew: false, household });
  };

  const handleSaveHousehold = (household: Household, memberIds: Set<string>) => {
    setTree((prev) => setHouseholdMembers(saveHousehold(prev, household), household.id, memberIds));
  };

  const handleDeleteHousehold = (id: string) => {
    setTree((prev) => removeHousehold(prev, id));
    if (highlightHouseholdId === id) setHighlightHouseholdId(null);
  };

  const handleExportPng = async () => {
    setSelectedId(null);
    setExporting(true);
    try {
      await exportToPng(nodes, `${tree.name}_家系図.png`);
    } finally {
      setExporting(false);
    }
  };

  const toolBtn = 'text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors';

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* トップバー */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0 flex-wrap">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          ← 戻る
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-800 truncate">{tree.name}</h1>
          <p className="text-[11px] text-gray-400">{tree.persons.length} 人</p>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          続柄
          <select
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 max-w-40 focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={tree.viewpointId ?? ''}
            onChange={(e) => handleSetViewpoint(e.target.value || undefined)}
          >
            <option value="">表示しない</option>
            {tree.persons.map((p) => <option key={p.id} value={p.id}>{fullName(p)} から見る</option>)}
          </select>
        </label>

        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          {(['western', 'japanese'] as const).map((era) => (
            <button
              key={era}
              onClick={() => setTree((prev) => ({ ...prev, eraDisplay: era }))}
              className={`px-3 py-1 text-xs rounded-md transition-all font-medium ${
                tree.eraDisplay === era ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {era === 'western' ? '西暦' : '和暦'}
            </button>
          ))}
        </div>
        {hasManualLayout && (
          <button onClick={handleResetLayout} className={toolBtn}>
            レイアウトをリセット
          </button>
        )}
        <button onClick={handleExportPng} disabled={exporting} className={toolBtn}>
          {exporting ? '書き出し中…' : '画像で保存'}
        </button>
        <button onClick={() => exportToJSON(tree)} className={toolBtn}>
          データを書き出す
        </button>
      </div>

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={handleNodesChange}
          nodeDragThreshold={4}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeClick={(_, n) => {
            if (n.type === 'person') setSelectedId(n.id);
            else if ((n.data as UnionNodePayload).hasPartners) setModal({ kind: 'union', unionId: n.id });
          }}
          onNodeDoubleClick={(_, n) => { if (n.type === 'person') handleEdit(n.id); }}
          onPaneClick={() => setSelectedId(null)}
          zoomOnDoubleClick={false}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background color="#e2e8f0" gap={24} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'union') return '#94a3b8';
              const d = n.data as PersonNodePayload;
              if (d.household) return d.household.color;
              const g = d.person.gender;
              return g === 'male' ? '#7dd3fc' : g === 'female' ? '#fda4af' : '#d1d5db';
            }}
            maskColor="rgba(248,249,250,0.7)"
          />
        </ReactFlow>

        <HouseholdPanel
          households={tree.households}
          persons={tree.persons}
          highlightId={highlightHouseholdId}
          onHighlight={setHighlightHouseholdId}
          onEdit={openHousehold}
          onAdd={openNewHousehold}
        />

        {tree.persons.length === 1 && !selectedId && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2 shadow border border-blue-100 text-xs text-gray-600 pointer-events-none">
            人物をクリックすると、親・配偶者・子・兄弟姉妹を追加できます
          </div>
        )}
      </div>

      {modalProps && (
        <PersonModal
          key={modalProps.initial.id}
          {...modalProps}
          households={tree.households}
          onSave={handleSavePerson}
          onClose={() => setModal(null)}
        />
      )}

      {modalUnion && (
        <UnionModal
          union={modalUnion}
          partnerNames={modalUnion.partners
            .map((id) => tree.persons.find((p) => p.id === id))
            .filter((p): p is Person => !!p)
            .map(fullName)
            .join(' と ')}
          onChange={(u) => setTree((prev) => updateUnion(prev, u))}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === 'household' && (
        <HouseholdModal
          key={modal.household.id}
          household={modal.household}
          isNew={modal.isNew}
          persons={tree.persons}
          households={tree.households}
          onSave={handleSaveHousehold}
          onDelete={handleDeleteHousehold}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
