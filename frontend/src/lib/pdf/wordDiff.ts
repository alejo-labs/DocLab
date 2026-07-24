export type DiffType = 'eq' | 'add' | 'del';
export interface DiffOp { type: DiffType; text: string }

const MAX_WORDS = 6000; // cota de seguridad para el DP O(n·m)

/** Diff de palabras (LCS) entre dos textos. Puro y testeable en Node. */
export function diffWords(a: string, b: string): DiffOp[] {
  const aw = a.split(/\s+/).filter(Boolean);
  const bw = b.split(/\s+/).filter(Boolean);
  if (aw.length > MAX_WORDS || bw.length > MAX_WORDS) {
    return a === b ? [{ type: 'eq', text: a }] : [{ type: 'del', text: a }, { type: 'add', text: b }];
  }
  const n = aw.length;
  const m = bw.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = aw[i] === bw[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ops: DiffOp[] = [];
  const push = (type: DiffType, word: string) => {
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.text += ` ${word}`;
    else ops.push({ type, text: word });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aw[i] === bw[j]) { push('eq', aw[i]!); i += 1; j += 1; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { push('del', aw[i]!); i += 1; }
    else { push('add', bw[j]!); j += 1; }
  }
  while (i < n) { push('del', aw[i]!); i += 1; }
  while (j < m) { push('add', bw[j]!); j += 1; }
  return ops;
}

/** Solapamiento de palabras (Jaccard) para decidir si dos párrafos son "el mismo". */
function jaccard(a: string, b: string): number {
  const sa = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const sb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}
const similar = (a: string, b: string) => a === b || jaccard(a, b) >= 0.6;

export interface ParaDiff { ops: DiffOp[]; changed: boolean }

/** Alinea los párrafos de dos páginas (LCS por similitud) y hace diff de palabras de los emparejados. */
export function alignParagraphs(a: string[], b: string[]): ParaDiff[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = similar(a[i]!, b[j]!) ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: ParaDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (similar(a[i]!, b[j]!)) {
      const ops = diffWords(a[i]!, b[j]!);
      out.push({ ops, changed: ops.some((o) => o.type !== 'eq') });
      i += 1; j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ ops: [{ type: 'del', text: a[i]! }], changed: true });
      i += 1;
    } else {
      out.push({ ops: [{ type: 'add', text: b[j]! }], changed: true });
      j += 1;
    }
  }
  while (i < n) { out.push({ ops: [{ type: 'del', text: a[i]! }], changed: true }); i += 1; }
  while (j < m) { out.push({ ops: [{ type: 'add', text: b[j]! }], changed: true }); j += 1; }
  return out;
}
