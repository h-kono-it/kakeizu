import type { FamilyTree, Gender, Person } from '../types';
import { compareAge } from './dateFormat';

// 親(P)・子(C)・配偶者(S)・兄弟姉妹(B) を1歩として、基準の人からの最短経路を続柄に変換する
type StepKind = 'P' | 'C' | 'S' | 'B';
interface Step { kind: StepKind; to: Person; divorced?: boolean }

type Relations = Pick<FamilyTree, 'persons' | 'unions'>;

const MAX_DEPTH = 8;

const pick = (g: Gender, male: string, female: string, other: string) =>
  g === 'male' ? male : g === 'female' ? female : other;

// cmp: 対象が比較相手より年上なら負
const sibling = (g: Gender, cmp: number) =>
  cmp < 0 ? pick(g, '兄', '姉', '兄姉')
    : cmp > 0 ? pick(g, '弟', '妹', '弟妹')
      : pick(g, '兄弟', '姉妹', 'きょうだい');

type Term = (from: Person, steps: Step[]) => string;

const spouse: Term = (_, [s]) =>
  s.divorced ? pick(s.to.gender, '元夫', '元妻', '元配偶者') : pick(s.to.gender, '夫', '妻', '配偶者');

// 経路の先頭から当てはめる血縁の続柄
const BLOOD: Record<string, Term> = {
  PPP: (_, s) => pick(s[2].to.gender, '曾祖父', '曾祖母', '曾祖父母'),
  CCC: () => 'ひ孫',
  PBC: () => 'いとこ',
  PPB: (_, s) => pick(s[2].to.gender, '大おじ', '大おば', '大おじ・大おば'),
  PP: (_, s) => pick(s[1].to.gender, '祖父', '祖母', '祖父母'),
  CC: () => '孫',
  PB: (_, [p, b]) => {
    const cmp = compareAge(b.to, p.to);
    return cmp < 0 ? pick(b.to.gender, '伯父', '伯母', 'おじ・おば')
      : cmp > 0 ? pick(b.to.gender, '叔父', '叔母', 'おじ・おば')
        : pick(b.to.gender, 'おじ', 'おば', 'おじ・おば');
  },
  BC: (_, s) => pick(s[1].to.gender, '甥', '姪', '甥・姪'),
  // 片親だけが同じ兄弟姉妹（同じ親の組を経由する場合は B になる）
  PC: (from, [p, c]) => `${pick(p.to.gender, '異母', '異父', '片親違いの')}${sibling(c.to.gender, compareAge(c.to, from))}`,
  S: spouse,
  P: (_, [s]) => pick(s.to.gender, '父', '母', '親'),
  C: (_, [s]) => pick(s.to.gender, '息子', '娘', '子'),
  B: (from, [s]) => sibling(s.to.gender, compareAge(s.to, from)),
};

// 経路全体がこの形のときだけ使う姻族の続柄（それ以外は「夫の〇〇」と分解する）
const IN_LAW: Record<string, Term> = {
  SP: (_, s) => pick(s[1].to.gender, '義父', '義母', '義理の親'),
  SPP: (_, s) => pick(s[2].to.gender, '義祖父', '義祖母', '義理の祖父母'),
  SB: (_, [s, b]) => `義${sibling(b.to.gender, compareAge(b.to, s.to))}`,
  // 兄の妻 = 義姉、妹の夫 = 義弟 のように、きょうだいの年齢と相手の性別で決まる
  BS: (from, [b, s]) => {
    const cmp = compareAge(b.to, from);
    if (cmp === 0 || s.to.gender === 'unknown' || s.to.gender === 'other') return 'きょうだいの配偶者';
    return `義${sibling(s.to.gender, cmp)}`;
  },
  CS: (_, s) => pick(s[1].to.gender, '婿', '嫁', '子の配偶者'),
};

function describe(from: Person, steps: Step[], top = true): string {
  const whole = steps.map((s) => s.kind).join('');
  if (top && IN_LAW[whole]) return IN_LAW[whole](from, steps);

  for (const len of [3, 2, 1]) {
    if (steps.length < len) continue;
    const head = steps.slice(0, len);
    const term = BLOOD[head.map((s) => s.kind).join('')];
    if (!term) continue;
    const rest = steps.slice(len);
    const label = term(from, head);
    return rest.length === 0 ? label : `${label}の${describe(head[len - 1].to, rest, false)}`;
  }
  return '親戚';
}

function neighbors(tree: Relations, byId: Map<string, Person>, id: string): Step[] {
  const steps: Step[] = [];
  const add = (kind: StepKind, otherId: string, divorced?: boolean) => {
    const to = byId.get(otherId);
    if (to && otherId !== id) steps.push({ kind, to, divorced });
  };
  // 同じ長さの経路なら 配偶者 → 親 → 兄弟姉妹 → 子 の順に優先する
  for (const u of tree.unions) {
    if (u.partners.includes(id)) u.partners.forEach((p) => add('S', p, u.divorced));
  }
  for (const u of tree.unions) {
    if (u.children.includes(id)) {
      u.partners.forEach((p) => add('P', p));
      u.children.forEach((c) => add('B', c));
    }
  }
  for (const u of tree.unions) {
    if (u.partners.includes(id)) u.children.forEach((c) => add('C', c));
  }
  return steps;
}

/** 基準の人から見た、各人物の続柄。たどれない人は含まない */
export function kinshipTerms(tree: Relations, viewpointId: string): Map<string, string> {
  const byId = new Map(tree.persons.map((p) => [p.id, p]));
  const origin = byId.get(viewpointId);
  const result = new Map<string, string>();
  if (!origin) return result;

  const paths = new Map<string, Step[]>([[viewpointId, []]]);
  const queue = [viewpointId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const path = paths.get(id)!;
    if (path.length >= MAX_DEPTH) continue;
    for (const step of neighbors(tree, byId, id)) {
      if (paths.has(step.to.id)) continue;
      paths.set(step.to.id, [...path, step]);
      queue.push(step.to.id);
    }
  }

  for (const [id, path] of paths) {
    result.set(id, path.length === 0 ? '本人' : describe(origin, path));
  }
  return result;
}
