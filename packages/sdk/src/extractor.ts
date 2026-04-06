export function extractJsDoc(source: string, byteOffset: number): string | null {
  const before = source.slice(0, byteOffset);
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
): { name: string; type: string } {
  // Handle RestElement: ...args
  if (param.type === 'RestElement') {
    const inner = param.argument as Record<string, unknown>;
    const result = extractParamType(inner, source);
    // Check if the RestElement itself has a typeAnnotation
    if (param.typeAnnotation) {
      const ta = param.typeAnnotation as { span: { start: number; end: number } };
      return { name: `...${result.name}`, type: source.slice(ta.span.start + 1, ta.span.end).trim() };
    }
    return { name: `...${result.name}`, type: result.type };
  }

  // Handle AssignmentPattern: param = defaultValue
  if (param.type === 'AssignmentPattern') {
    const left = param.left as Record<string, unknown>;
    return extractParamType(left, source);
  }

  // Handle Identifier
  if (param.type === 'Identifier') {
    const name = param.value as string;
    if (param.typeAnnotation) {
      const ta = param.typeAnnotation as { span: { start: number; end: number } };
      // +1 to skip the colon
      const type = source.slice(ta.span.start + 1, ta.span.end).trim();
      return { name, type };
    }
    return { name, type: 'unknown' };
  }

  // Fallback for object/array patterns
  if (param.type === 'ObjectPattern' || param.type === 'ArrayPattern') {
    const span = (param as Record<string, unknown>).span as { start: number; end: number } | undefined;
    if (param.typeAnnotation) {
      const ta = param.typeAnnotation as { span: { start: number; end: number } };
      const type = source.slice(ta.span.start + 1, ta.span.end).trim();
      return { name: span ? source.slice(span.start, span.end) : 'pattern', type };
    }
    return { name: span ? source.slice(span.start, span.end) : 'pattern', type: 'unknown' };
  }

  return { name: 'unknown', type: 'unknown' };
}

export function extractReturnType(
  node: Record<string, unknown>,
  source: string,
): string {
  const returnType = node.returnType as
    | { span: { start: number; end: number } }
    | undefined;
  if (!returnType) return 'unknown';
  // +1 to skip the colon
  return source.slice(returnType.span.start + 1, returnType.span.end).trim();
}

export class SourceMapper {
  private lineStarts: number[];

  constructor(source: string) {
    this.lineStarts = [0];
    for (let i = 0; i < source.length; i++) {
      if (source[i] === '\n') {
        this.lineStarts.push(i + 1);
      }
    }
  }

  getLocation(byteOffset: number): { line: number; column: number } {
    // Binary search for the line
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.lineStarts[mid] <= byteOffset) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return { line: lo + 1, column: byteOffset - this.lineStarts[lo] + 1 };
  }
}
