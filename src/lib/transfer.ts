import type { FamilyTree, Household, Person, Union } from '../types';
import { normalizeTree } from './storage';
import { downloadUrl } from './download';

export function exportToJSON(tree: FamilyTree): void {
  const json = JSON.stringify(tree, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  downloadUrl(url, `${tree.name}_家系図.json`);
  URL.revokeObjectURL(url);
}

const VALID_GENDERS = new Set(['male', 'female', 'other', 'unknown']);
const optionalString = (v: unknown) => v === undefined || typeof v === 'string';
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

function isValidPerson(p: unknown): p is Person {
  if (!p || typeof p !== 'object') return false;
  const d = p as Record<string, unknown>;
  return (
    typeof d.id === 'string' && d.id.length > 0 &&
    typeof d.familyName === 'string' &&
    typeof d.givenName === 'string' &&
    VALID_GENDERS.has(d.gender as string) &&
    typeof d.deceased === 'boolean' &&
    optionalString(d.maidenName) &&
    optionalString(d.birthDate) &&
    optionalString(d.deathDate) &&
    optionalString(d.nickname) &&
    optionalString(d.tagline) &&
    optionalString(d.note) &&
    optionalString(d.householdId) &&
    (d.layoutX === undefined || (typeof d.layoutX === 'number' && Number.isFinite(d.layoutX)))
  );
}

function isValidUnion(u: unknown): u is Union {
  if (!u || typeof u !== 'object') return false;
  const d = u as Record<string, unknown>;
  return (
    typeof d.id === 'string' && d.id.length > 0 &&
    isStringArray(d.partners) && d.partners.length <= 2 &&
    isStringArray(d.children) &&
    (d.divorced === undefined || typeof d.divorced === 'boolean')
  );
}

function isValidHousehold(h: unknown): h is Household {
  if (!h || typeof h !== 'object') return false;
  const d = h as Record<string, unknown>;
  return typeof d.id === 'string' && typeof d.name === 'string' && typeof d.color === 'string' && /^#[0-9a-f]{6}$/i.test(d.color);
}

// 自分が自分の祖先になっていないか（人物 → 子 の有向グラフで閉路検出）
function hasCycle(unions: Union[]): boolean {
  const childrenOf = new Map<string, string[]>();
  for (const u of unions) {
    for (const p of u.partners) {
      childrenOf.set(p, [...(childrenOf.get(p) ?? []), ...u.children]);
    }
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 'visiting') return true;
    if (state.get(id) === 'done') return false;
    state.set(id, 'visiting');
    if ((childrenOf.get(id) ?? []).some(visit)) return true;
    state.set(id, 'done');
    return false;
  };
  return [...childrenOf.keys()].some(visit);
}

function isValidTree(data: unknown): data is FamilyTree {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (
    typeof d.id !== 'string' ||
    typeof d.name !== 'string' ||
    !Array.isArray(d.persons) ||
    !Array.isArray(d.unions) ||
    (d.eraDisplay !== 'western' && d.eraDisplay !== 'japanese') ||
    typeof d.createdAt !== 'string' ||
    typeof d.updatedAt !== 'string'
  ) return false;

  if (!d.persons.every(isValidPerson) || !d.unions.every(isValidUnion)) return false;
  if (d.households !== undefined && !(Array.isArray(d.households) && d.households.every(isValidHousehold))) return false;
  if (!optionalString(d.viewpointId)) return false;

  const persons = d.persons as Person[];
  const unions = d.unions as Union[];

  // ID の重複チェック
  const ids = new Set(persons.map((p) => p.id));
  if (ids.size !== persons.length) return false;

  // 存在しない人物を参照していないか、1人が複数の親の組に属していないか
  const childSeen = new Set<string>();
  for (const u of unions) {
    if (![...u.partners, ...u.children].every((id) => ids.has(id))) return false;
    for (const c of u.children) {
      if (childSeen.has(c)) return false;
      childSeen.add(c);
    }
  }

  if (hasCycle(unions)) return false;

  const householdIds = new Set(((d.households ?? []) as Household[]).map((h) => h.id));
  if (!persons.every((p) => p.householdId === undefined || householdIds.has(p.householdId))) return false;
  if (d.viewpointId !== undefined && !ids.has(d.viewpointId as string)) return false;

  return true;
}

export function importFromJSON(file: File): Promise<FamilyTree> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!isValidTree(parsed)) {
          reject(new Error('有効な家系図ファイルではありません'));
          return;
        }
        resolve(normalizeTree(parsed));
      } catch {
        reject(new Error('JSONの読み込みに失敗しました'));
      }
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsText(file);
  });
}
