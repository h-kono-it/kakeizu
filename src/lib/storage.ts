import type { FamilyTree } from '../types';

const KEY = 'kakeizu-trees';

// 世帯機能より前に保存されたデータを補う
export function normalizeTree(t: FamilyTree): FamilyTree {
  return { ...t, households: t.households ?? [] };
}

export const storage = {
  loadAll(): FamilyTree[] {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as FamilyTree[]).map(normalizeTree) : [];
    } catch {
      return [];
    }
  },

  save(tree: FamilyTree): void {
    const all = this.loadAll();
    const idx = all.findIndex((t) => t.id === tree.id);
    if (idx >= 0) {
      all[idx] = tree;
    } else {
      all.unshift(tree);
    }
    localStorage.setItem(KEY, JSON.stringify(all));
  },

  delete(id: string): void {
    const all = this.loadAll().filter((t) => t.id !== id);
    localStorage.setItem(KEY, JSON.stringify(all));
  },
};
