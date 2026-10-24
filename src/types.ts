export type Gender = 'male' | 'female' | 'other' | 'unknown';
export type EraDisplay = 'western' | 'japanese';

export interface Person {
  id: string;
  familyName: string;
  givenName: string;
  maidenName?: string;     // 旧姓
  gender: Gender;
  birthDate?: string;      // YYYY / YYYY-MM / YYYY-MM-DD
  deathDate?: string;
  deceased: boolean;       // 没年不明でも故人として扱えるように別フラグで持つ
  nickname?: string;       // 家族内での呼び名（「ばあちゃん」など）
  tagline?: string;        // カードに表示する一言
  note?: string;
  householdId?: string;
  layoutX?: number;        // ドラッグで手動調整した横位置（未設定なら自動レイアウト）
}

// 実際に一緒に暮らしている単位。1人が属せるのは1世帯まで
export interface Household {
  id: string;
  name: string;
  color: string;
}

// 婚姻・パートナー関係。人同士を直接つながず、親子関係はこのノードを経由する（GEDCOM の FAM と同じ考え方）
export interface Union {
  id: string;
  partners: string[];      // 0〜2人。0人 = 親不明の兄弟グループ
  children: string[];
  divorced?: boolean;
}

export interface FamilyTree {
  id: string;
  name: string;
  persons: Person[];
  unions: Union[];
  households: Household[];
  viewpointId?: string;    // 続柄表示の基準になる人
  eraDisplay: EraDisplay;
  createdAt: string;
  updatedAt: string;
}

export type Relation = 'parent' | 'spouse' | 'child' | 'sibling';
