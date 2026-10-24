import type { ELK, ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk-api';
import type { FamilyTree } from '../types';
import { compareAge } from './dateFormat';

export const PERSON_W = 180;
export const PERSON_H = 96;
export const UNION_SIZE = 14;

// ELK 本体は 1MB 超あるので初回レイアウト時に遅延読み込みする
let elkPromise: Promise<ELK> | null = null;
function getElk(): Promise<ELK> {
  elkPromise ??= import('elkjs/lib/elk.bundled.js').then(({ default: ElkCtor }) => new ElkCtor());
  return elkPromise;
}

const LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.spacing.nodeNode': '32',
  'elk.layered.spacing.nodeNodeBetweenLayers': '36',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  // 入力順を尊重させ、配偶者同士が隣に並びやすくする
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  // 同じ世代内の左右の並びは personOrder の順を守らせる
  'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
};

/**
 * 世代内の並び順を決める。
 * 血縁者を親から辿り、兄弟姉妹は年長順。婚姻で入った人（親が未登録の配偶者）は
 * 兄弟姉妹グループの外側に来るよう、前半の子は左側・後半の子は右側に配偶者を置く。
 */
export function personOrder(tree: FamilyTree): string[] {
  const byId = new Map(tree.persons.map((p) => [p.id, p]));
  const hasParents = new Set(tree.unions.flatMap((u) => u.children));
  const unionsOf = (id: string) => tree.unions.filter((u) => u.partners.includes(id));
  const ordered: string[] = [];
  const seen = new Set<string>();

  const visit = (id: string, side: 'left' | 'right') => {
    if (seen.has(id)) return;
    seen.add(id);
    // 配偶者に加え、婚姻で入った配偶者の別の配偶者（再婚前の相手など）も同じ側へ連ねる
    const spouses: string[] = [];
    const queue = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const pid of unionsOf(cur).flatMap((u) => u.partners)) {
        if (seen.has(pid)) continue;
        seen.add(pid);
        spouses.push(pid);
        if (!hasParents.has(pid)) queue.push(pid);
      }
    }
    // 本人に近い順に並べる
    if (side === 'left') ordered.push(...[...spouses].reverse(), id);
    else ordered.push(id, ...spouses);

    const unions = [...new Set([id, ...spouses].flatMap(unionsOf))];
    for (const u of unions) {
      const kids = u.children
        .map((cid) => byId.get(cid)!)
        .sort(compareAge)
        .map((c) => c.id);
      const half = Math.floor(kids.length / 2);
      kids.forEach((cid, i) => visit(cid, i < half ? 'left' : 'right'));
    }
  };

  // 最上位の血縁者（親が未登録で、配偶者側にも親がいない人）から辿る
  for (const p of tree.persons) {
    const marriedIn = !hasParents.has(p.id) &&
      unionsOf(p.id).some((u) => u.partners.some((pid) => hasParents.has(pid)));
    if (!hasParents.has(p.id) && !marriedIn) visit(p.id, 'right');
  }
  // 取りこぼし（親子関係のループ等は無い前提だが念のため）
  for (const p of tree.persons) visit(p.id, 'right');
  return ordered;
}

export interface Position { x: number; y: number }

/** 人物 → 夫婦ノード → 子 の DAG として ELK でレイアウトし、各ノードの左上座標を返す */
export async function layoutTree(tree: FamilyTree): Promise<Map<string, Position>> {
  const ordered = personOrder(tree);

  const children: ElkNode[] = [
    ...ordered.map((id) => ({ id, width: PERSON_W, height: PERSON_H })),
    ...tree.unions.map((u) => ({ id: u.id, width: UNION_SIZE, height: UNION_SIZE })),
  ];

  const edges: ElkExtendedEdge[] = tree.unions.flatMap((u) => [
    ...u.partners.map((pid) => ({ id: `${pid}>${u.id}`, sources: [pid], targets: [u.id] })),
    ...u.children.map((cid) => ({ id: `${u.id}>${cid}`, sources: [u.id], targets: [cid] })),
  ]);

  const elk = await getElk();
  const result = await elk.layout({ id: 'root', layoutOptions: LAYOUT_OPTIONS, children, edges });

  return new Map((result.children ?? []).map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));
}
