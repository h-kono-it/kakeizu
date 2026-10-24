import type { FamilyTree, Household, Person, Union, Relation } from '../types';

export function fullName(p: Person): string {
  return `${p.familyName} ${p.givenName}`.trim() || '（名前未入力）';
}

export function parentUnionOf(tree: FamilyTree, personId: string): Union | undefined {
  return tree.unions.find((u) => u.children.includes(personId));
}

export function unionsAsPartner(tree: FamilyTree, personId: string): Union[] {
  return tree.unions.filter((u) => u.partners.includes(personId));
}

export function canAddParent(tree: FamilyTree, personId: string): boolean {
  const u = parentUnionOf(tree, personId);
  return !u || u.partners.length < 2;
}

function newUnion(partners: string[], children: string[]): Union {
  return { id: crypto.randomUUID(), partners, children };
}

/**
 * baseId の人物から見た relation として person を追加する。
 * 子の追加では targetUnionId で親の組み合わせを指定できる（未指定ならひとり親として新しい関係を作る）。
 */
export function addRelative(
  tree: FamilyTree,
  baseId: string,
  relation: Relation,
  person: Person,
  targetUnionId?: string,
): FamilyTree {
  const persons = [...tree.persons, person];
  let unions = tree.unions;

  switch (relation) {
    case 'parent': {
      const pu = parentUnionOf(tree, baseId);
      unions = pu
        ? unions.map((u) => (u.id === pu.id ? { ...u, partners: [...u.partners, person.id] } : u))
        : [...unions, newUnion([person.id], [baseId])];
      break;
    }
    case 'spouse':
      unions = [...unions, newUnion([baseId, person.id], [])];
      break;
    case 'child':
      unions = targetUnionId
        ? unions.map((u) => (u.id === targetUnionId ? { ...u, children: [...u.children, person.id] } : u))
        : [...unions, newUnion([baseId], [person.id])];
      break;
    case 'sibling': {
      const pu = parentUnionOf(tree, baseId);
      unions = pu
        ? unions.map((u) => (u.id === pu.id ? { ...u, children: [...u.children, person.id] } : u))
        : [...unions, newUnion([], [baseId, person.id])];
      break;
    }
  }

  return { ...tree, persons, unions };
}

// 意味を持たなくなった関係（配偶者だけ消えて子もいない等）を取り除く
function isMeaningful(u: Union): boolean {
  if (u.partners.length === 0) return u.children.length >= 2;
  return u.partners.length + u.children.length >= 2;
}

export function removePerson(tree: FamilyTree, personId: string): FamilyTree {
  return {
    ...tree,
    viewpointId: tree.viewpointId === personId ? undefined : tree.viewpointId,
    persons: tree.persons.filter((p) => p.id !== personId),
    unions: tree.unions
      .map((u) => ({
        ...u,
        partners: u.partners.filter((id) => id !== personId),
        children: u.children.filter((id) => id !== personId),
      }))
      .filter(isMeaningful),
  };
}

export function updatePerson(tree: FamilyTree, person: Person): FamilyTree {
  return { ...tree, persons: tree.persons.map((p) => (p.id === person.id ? person : p)) };
}

export function updateUnion(tree: FamilyTree, union: Union): FamilyTree {
  return { ...tree, unions: tree.unions.map((u) => (u.id === union.id ? union : u)) };
}

/** personId の子孫（本人は含まない） */
export function descendantIds(tree: FamilyTree, personId: string): Set<string> {
  const result = new Set<string>();
  const queue = [personId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const u of tree.unions) {
      if (!u.partners.includes(id)) continue;
      for (const c of u.children) {
        if (!result.has(c)) { result.add(c); queue.push(c); }
      }
    }
  }
  return result;
}

export function unionLabel(tree: FamilyTree, u: Union): string {
  const name = (id: string) => {
    const p = tree.persons.find((x) => x.id === id);
    return p ? fullName(p) : '?';
  };
  const base = u.partners.length > 0
    ? u.partners.map(name).join(' と ')
    : `親不明（${u.children.map(name).join('・')} の兄弟姉妹）`;
  return u.divorced ? `${base}（離別）` : base;
}

/** personId の親の組として選べる関係。自分や子孫が親になる組は循環するので除く */
export function parentUnionCandidates(tree: FamilyTree, personId: string): Union[] {
  const forbidden = descendantIds(tree, personId).add(personId);
  return tree.unions.filter((u) => !u.partners.some((id) => forbidden.has(id)));
}

/** personId を unionId の子に付け替える。null なら親の登録を外す */
export function setParentUnion(tree: FamilyTree, personId: string, unionId: string | null): FamilyTree {
  return {
    ...tree,
    unions: tree.unions
      .map((u) => {
        const children = u.children.filter((id) => id !== personId);
        return { ...u, children: u.id === unionId ? [...children, personId] : children };
      })
      .filter(isMeaningful),
  };
}

export const HOUSEHOLD_COLORS = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#84cc16'];

export function saveHousehold(tree: FamilyTree, household: Household): FamilyTree {
  const exists = tree.households.some((h) => h.id === household.id);
  return {
    ...tree,
    households: exists
      ? tree.households.map((h) => (h.id === household.id ? household : h))
      : [...tree.households, household],
  };
}

export function removeHousehold(tree: FamilyTree, householdId: string): FamilyTree {
  return {
    ...tree,
    households: tree.households.filter((h) => h.id !== householdId),
    persons: tree.persons.map((p) => (p.householdId === householdId ? { ...p, householdId: undefined } : p)),
  };
}

/** 世帯の構成員を memberIds に置き換える（他の世帯にいた人はこちらへ移る） */
export function setHouseholdMembers(tree: FamilyTree, householdId: string, memberIds: Set<string>): FamilyTree {
  return {
    ...tree,
    persons: tree.persons.map((p) => {
      if (memberIds.has(p.id)) return { ...p, householdId };
      return p.householdId === householdId ? { ...p, householdId: undefined } : p;
    }),
  };
}
