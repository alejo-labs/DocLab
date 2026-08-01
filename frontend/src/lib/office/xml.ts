/**
 * Parser XML minimalista, sin dependencias, suficiente para OOXML (SpreadsheetML).
 * Trabaja igual en navegador y en Node (testeable). No soporta mixed-content raro
 * ni `>` sin escapar dentro de atributos (OOXML no los usa).
 */
export interface XmlNode {
  name: string; // nombre local (prefijo de namespace eliminado)
  attrs: Record<string, string>; // claves verbatim (p. ej. "r:id" se conserva)
  children: XmlNode[];
  text: string; // texto directo concatenado
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(s: string): string {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (whole, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[e] ?? whole;
  });
}

function localName(n: string): string {
  const i = n.indexOf(':');
  return i >= 0 ? n.slice(i + 1) : n;
}

const ATTR_RE = /([\w:.-]+)\s*=\s*"([^"]*)"|([\w:.-]+)\s*=\s*'([^']*)'/g;

function parseTag(tag: string): { name: string; attrs: Record<string, string> } {
  let k = 0;
  while (k < tag.length && !/\s/.test(tag[k]!)) k += 1;
  const name = tag.slice(0, k);
  const attrs: Record<string, string> = {};
  const rest = tag.slice(k);
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(rest))) {
    const key = (m[1] ?? m[3])!;
    const val = m[2] ?? m[4] ?? '';
    attrs[key] = decode(val);
  }
  return { name, attrs };
}

/** Parsea un documento XML y devuelve su elemento raíz. */
export function parseXml(src: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) break;
    if (lt > i) {
      const txt = src.slice(i, lt);
      if (txt.trim()) stack[stack.length - 1]!.text += decode(txt);
    }
    if (src.startsWith('<!--', lt)) { const end = src.indexOf('-->', lt + 4); i = end < 0 ? n : end + 3; continue; }
    if (src.startsWith('<![CDATA[', lt)) { const end = src.indexOf(']]>', lt + 9); stack[stack.length - 1]!.text += src.slice(lt + 9, end < 0 ? n : end); i = end < 0 ? n : end + 3; continue; }
    if (src.startsWith('<?', lt)) { const end = src.indexOf('?>', lt + 2); i = end < 0 ? n : end + 2; continue; }
    if (src.startsWith('<!', lt)) { const end = src.indexOf('>', lt + 2); i = end < 0 ? n : end + 1; continue; }
    const gt = src.indexOf('>', lt);
    if (gt < 0) break;
    let tag = src.slice(lt + 1, gt).trim();
    if (tag.startsWith('/')) { if (stack.length > 1) stack.pop(); i = gt + 1; continue; }
    const selfClose = tag.endsWith('/');
    if (selfClose) tag = tag.slice(0, -1).trim();
    const { name, attrs } = parseTag(tag);
    const node: XmlNode = { name: localName(name), attrs, children: [], text: '' };
    stack[stack.length - 1]!.children.push(node);
    if (!selfClose) stack.push(node);
    i = gt + 1;
  }
  return root.children[0] ?? root;
}

/** Primer hijo con ese nombre local. */
export function child(node: XmlNode, name: string): XmlNode | undefined {
  return node.children.find((c) => c.name === name);
}
/** Todos los hijos (en profundidad 1) con ese nombre local. */
export function kids(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((c) => c.name === name);
}
/** Atributo por clave (verbatim, incluido prefijo como "r:id"). */
export function attr(node: XmlNode | undefined, key: string): string | undefined {
  return node?.attrs[key];
}
/** Busca recursivamente el primer descendiente con ese nombre local. */
export function find(node: XmlNode, name: string): XmlNode | undefined {
  for (const c of node.children) {
    if (c.name === name) return c;
    const deep = find(c, name);
    if (deep) return deep;
  }
  return undefined;
}
