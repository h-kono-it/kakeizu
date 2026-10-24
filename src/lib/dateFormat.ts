import type { EraDisplay, Person } from '../types';

const DATE_RE = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/;

export function isValidDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const month = m[2] ? Number(m[2]) : 1;
  const day = m[3] ? Number(m[3]) : 1;
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

const japaneseYear = new Intl.DateTimeFormat('ja-JP-u-ca-japanese', { era: 'long', year: 'numeric' });

function formatYear(s: string, era: EraDisplay): string {
  const m = DATE_RE.exec(s);
  if (!m) return s;
  if (era === 'western') return `${m[1]}年`;
  // 年のみの場合は改元年の判定がぶれるので年央で判定する
  const date = new Date(Number(m[1]), m[2] ? Number(m[2]) - 1 : 6, m[3] ? Number(m[3]) : 1);
  return japaneseYear.format(date);
}

export function lifespan(p: Person, era: EraDisplay): string {
  const birth = p.birthDate ? formatYear(p.birthDate, era) : '';
  if (p.deathDate) return `${birth || '?'} – ${formatYear(p.deathDate, era)}没`;
  if (p.deceased) return `${birth || '?'} – 没`;
  return birth ? `${birth}生` : '';
}

type Ymd = [number, number, number];

function lastDayOfMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

// 年や月が省略された日付が取りうる、最も早い日と最も遅い日
function dateRange(s: string): [Ymd, Ymd] | null {
  const m = DATE_RE.exec(s);
  if (!m || !isValidDate(s)) return null;
  const y = Number(m[1]);
  const month = m[2] ? Number(m[2]) : undefined;
  const day = m[3] ? Number(m[3]) : undefined;
  return [
    [y, month ?? 1, day ?? 1],
    [y, month ?? 12, day ?? lastDayOfMonth(y, month ?? 12)],
  ];
}

/** a が b より年上なら負、年下なら正、判定できなければ 0 */
export function compareAge(a: Person, b: Person): number {
  const ra = a.birthDate ? dateRange(a.birthDate) : null;
  const rb = b.birthDate ? dateRange(b.birthDate) : null;
  if (!ra || !rb) return 0;
  const key = ([y, m, d]: Ymd) => y * 10000 + m * 100 + d;
  if (key(ra[1]) < key(rb[0])) return -1;
  if (key(rb[1]) < key(ra[0])) return 1;
  return 0;
}

function ageAt([by, bm, bd]: Ymd, [ay, am, ad]: Ymd): number {
  return ay - by - (am < bm || (am === bm && ad < bd) ? 1 : 0);
}

/**
 * 満年齢。存命なら今日時点、没年月日があれば没年齢（「没 80歳」）。
 * 故人で没年不明の場合や生年月日がない場合は null。
 * 日付が年だけなどで確定できない場合は「34〜35歳」のように幅を持たせる。
 */
export function ageLabel(p: Person, today: Date = new Date()): string | null {
  const birth = p.birthDate ? dateRange(p.birthDate) : null;
  if (!birth) return null;

  let at: [Ymd, Ymd];
  if (p.deathDate) {
    const death = dateRange(p.deathDate);
    if (!death) return null;
    at = death;
  } else if (p.deceased) {
    return null;
  } else {
    const t: Ymd = [today.getFullYear(), today.getMonth() + 1, today.getDate()];
    at = [t, t];
  }

  const min = Math.max(ageAt(birth[1], at[0]), 0);
  const max = ageAt(birth[0], at[1]);
  if (max < 0) return null;

  const text = min === max ? `${max}歳` : `${min}〜${max}歳`;
  return p.deathDate ? `没 ${text}` : text;
}
