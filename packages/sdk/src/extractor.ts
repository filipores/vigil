export function extractJsDoc(source: string, byteOffset: number, mapper?: SourceMapper): string | null {
  const charOffset = mapper ? mapper.toCharOffset(byteOffset) : byteOffset;
  const before = source.slice(0, charOffset);
  const trimmed = before.trimEnd();
  if (!trimmed.endsWith('*/')) return null;

  const closeIdx = trimmed.length - 2;
  const openIdx = trimmed.lastIndexOf('/**', closeIdx);
  if (openIdx === -1) return null;

  return trimmed.slice(openIdx, trimmed.length);
}

export function extractParamType(
  param: Record<string, unknown>,
  source: string,
  mapper?: SourceMapper,
): { name: string; type: string } {
  /** Slice source using byte-offset span, converting via mapper when available. */
  const sliceSpan = (start: number, end: number) =>
    mapper ? source.slice(mapper.toCharOffset(start), mapper.toCharOffset(end)) : source.slice(start, end);

  // Handle RestElement: ...args
  if (param.type === 'RestElement') {
    const inner = param.argument as Record<string, unknown>;
    const result = extractParamType(inner, source, mapper);
    // Check if the RestElement itself has a typeAnnotation
    if (param.typeAnnotation) {
      const ta = param.typeAnnotation as { span: { start: number; end: number } };
      return { name: `...${result.name}`, type: sliceSpan(ta.span.start + 1, ta.span.end).trim() };
    }
    return { name: `...${result.name}`, type: result.type };
  }

  // Handle AssignmentPattern: param = defaultValue
  if (param.type === 'AssignmentPattern') {
    const left = param.left as Record<string, unknown>;
    return extractParamType(left, source, mapper);
  }

  // Handle Identifier
  if (param.type === 'Identifier') {
    const name = param.value as string;
    if (param.typeAnnotation) {
      const ta = param.typeAnnotation as { span: { start: number; end: number } };
      // +1 to skip the colon
      const type = sliceSpan(ta.span.start + 1, ta.span.end).trim();
      return { name, type };
    }
    return { name, type: 'unknown' };
  }

  // Fallback for object/array patterns
  if (param.type === 'ObjectPattern' || param.type === 'ArrayPattern') {
    const span = (param as Record<string, unknown>).span as { start: number; end: number } | undefined;
    if (param.typeAnnotation) {
      const ta = param.typeAnnotation as { span: { start: number; end: number } };
      const type = sliceSpan(ta.span.start + 1, ta.span.end).trim();
      return { name: span ? sliceSpan(span.start, span.end) : 'pattern', type };
    }
    return { name: span ? sliceSpan(span.start, span.end) : 'pattern', type: 'unknown' };
  }

  return { name: 'unknown', type: 'unknown' };
}

export function extractReturnType(
  node: Record<string, unknown>,
  source: string,
  mapper?: SourceMapper,
): string {
  const returnType = node.returnType as
    | { span: { start: number; end: number } }
    | undefined;
  if (!returnType) return 'unknown';
  // +1 to skip the colon
  const start = mapper ? mapper.toCharOffset(returnType.span.start + 1) : returnType.span.start + 1;
  const end = mapper ? mapper.toCharOffset(returnType.span.end) : returnType.span.end;
  return source.slice(start, end).trim();
}

export class SourceMapper {
  private lineStarts: number[];
  private byteToChar: Int32Array;

  constructor(source: string) {
    this.lineStarts = [0];

    // Build byte-offset → char-offset mapping.
    // SWC spans are byte offsets into the UTF-8 encoded source, but JS strings
    // are UTF-16 — multi-byte UTF-8 characters (e.g. "ü", "ä", emoji) cause
    // the two index spaces to diverge.
    const encoder = new TextEncoder();
    const encoded = encoder.encode(source);
    this.byteToChar = new Int32Array(encoded.length + 1);
    let charIdx = 0;
    let byteIdx = 0;
    while (charIdx < source.length) {
      this.byteToChar[byteIdx] = charIdx;
      const code = source.codePointAt(charIdx)!;
      // Byte length of this code point in UTF-8
      let byteLen: number;
      if (code <= 0x7f) byteLen = 1;
      else if (code <= 0x7ff) byteLen = 2;
      else if (code <= 0xffff) byteLen = 3;
      else byteLen = 4;
      // Char length in UTF-16 (surrogate pairs for code points above 0xFFFF)
      const charLen = code > 0xffff ? 2 : 1;

      if (source[charIdx] === '\n') {
        this.lineStarts.push(charIdx + 1);
      }

      byteIdx += byteLen;
      charIdx += charLen;
    }
    this.byteToChar[byteIdx] = charIdx; // sentinel for end-of-source
  }

  /** Convert a SWC byte offset to a JS string character offset. */
  toCharOffset(byteOffset: number): number {
    if (byteOffset <= 0) return 0;
    if (byteOffset >= this.byteToChar.length) return this.byteToChar[this.byteToChar.length - 1];
    return this.byteToChar[byteOffset];
  }

  getLocation(byteOffset: number): { line: number; column: number } {
    const charOffset = this.toCharOffset(byteOffset);
    // Binary search for the line
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.lineStarts[mid] <= charOffset) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return { line: lo + 1, column: charOffset - this.lineStarts[lo] + 1 };
  }
}
