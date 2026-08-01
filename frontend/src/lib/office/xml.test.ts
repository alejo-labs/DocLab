import { describe, it, expect } from 'vitest';
import { parseXml, child, kids, attr, find } from './xml';

describe('parseXml', () => {
  it('quita el prefijo de namespace y conserva atributos con prefijo', () => {
    const root = parseXml('<w:document xmlns:w="x"><w:body r:id="rId1"/></w:document>');
    expect(root.name).toBe('document');
    const body = child(root, 'body');
    expect(body).toBeDefined();
    expect(attr(body, 'r:id')).toBe('rId1');
  });
  it('decodifica entidades y referencias numéricas', () => {
    const root = parseXml('<t>a &amp; b &lt; c &#65; &#x42;</t>');
    expect(root.text).toBe('a & b < c A B');
  });
  it('soporta self-close, comentarios, CDATA y prólogo', () => {
    const root = parseXml('<?xml version="1.0"?><r><!-- x --><a/><b><![CDATA[<hola>]]></b></r>');
    expect(kids(root, 'a')).toHaveLength(1);
    expect(child(root, 'b')!.text).toBe('<hola>');
  });
  it('kids solo devuelve hijos directos; find busca en profundidad', () => {
    const root = parseXml('<r><a><a/></a><a/></r>');
    expect(kids(root, 'a')).toHaveLength(2); // dos <a> directos
    expect(find(root, 'a')).toBeDefined();
  });
});
