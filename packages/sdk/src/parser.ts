import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseSync } from '@swc/core';
import type { FunctionInfo, DataFlowEdge } from '@agent-monitor/types';
import { generateId } from './utils.js';
import { extractJsDoc, extractParamType, extractReturnType, SourceMapper } from './extractor.js';
import { categorize } from './categorize.js';

const SOURCE_PREVIEW_MAX_CHARS = 2000;

function getSourcePreview(source: string, startOffset: number, maxLines: number = 15): string {
  if (startOffset >= source.length) return '';
  let lineStart = startOffset;
  while (lineStart > 0 && source[lineStart - 1] !== '\n') lineStart--;
  const rest = source.slice(lineStart);
  const lines = rest.split('\n').slice(0, maxLines);
  let preview = lines.join('\n');
  if (preview.length > SOURCE_PREVIEW_MAX_CHARS) {
    preview = preview.slice(0, SOURCE_PREVIEW_MAX_CHARS) + '\n// ... truncated';
  }
  return preview;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AstNode = Record<string, any>;

function extractFunction(
  node: AstNode,
  source: string,
  filePath: string,
  mapper: SourceMapper,
): FunctionInfo | null {
  const name: string | undefined = node.identifier?.value ?? node.id?.value;
  if (!name) return null;

  const span = node.span as { start: number; end: number };
  const loc = mapper.getLocation(span.start);
  const params: AstNode[] = node.params ?? [];
  const parsedParams = params.map((p: AstNode) => {
    const paramNode = p.pat ?? p.param ?? p;
    return extractParamType(paramNode, source);
  });

  const returnType = extractReturnType(node, source);
  const jsdoc = extractJsDoc(source, span.start);
  const sourcePreview = getSourcePreview(source, span.start);

  return {
    id: generateId(filePath, name, loc.line),
    name,
    filePath,
    line: loc.line,
    column: loc.column,
    params: parsedParams,
    returnType,
    jsdoc,
    sourcePreview,
    lastModified: Date.now(),
    category: categorize(name, filePath, !!node.async, false),
  };
}

function extractFromArrowOrFnExpr(
  name: string,
  init: AstNode,
  source: string,
  filePath: string,
  mapper: SourceMapper,
  declSpan: { start: number; end: number },
): FunctionInfo | null {
  if (
    init.type !== 'ArrowFunctionExpression' &&
    init.type !== 'FunctionExpression'
  ) {
    return null;
  }

  const loc = mapper.getLocation(declSpan.start);
  const params: AstNode[] = init.params ?? [];
  const parsedParams = params.map((p: AstNode) => {
    const paramNode = p.pat ?? p.param ?? p;
    return extractParamType(paramNode, source);
  });

  const returnType = extractReturnType(init, source);
  const jsdoc = extractJsDoc(source, declSpan.start);
  const sourcePreview = getSourcePreview(source, declSpan.start);

  return {
    id: generateId(filePath, name, loc.line),
    name,
    filePath,
    line: loc.line,
    column: loc.column,
    params: parsedParams,
    returnType,
    jsdoc,
    sourcePreview,
    lastModified: Date.now(),
    category: categorize(name, filePath, !!init.async, false),
  };
}

function walkNode(
  node: AstNode,
  source: string,
  filePath: string,
  mapper: SourceMapper,
  results: FunctionInfo[],
): void {
  if (!node || typeof node !== 'object') return;

  switch (node.type) {
    case 'FunctionDeclaration': {
      const fn = extractFunction(node, source, filePath, mapper);
      if (fn) results.push(fn);
      break;
    }

    case 'VariableDeclaration': {
      const declarations: AstNode[] = node.declarations ?? [];
      for (const decl of declarations) {
        if (decl.type === 'VariableDeclarator' && decl.init && decl.id?.value) {
          const fn = extractFromArrowOrFnExpr(
            decl.id.value,
            decl.init,
            source,
            filePath,
            mapper,
            node.span,
          );
          if (fn) results.push(fn);
        }
      }
      break;
    }

    case 'ExportDefaultDeclaration': {
      const inner = node.decl;
      if (inner) walkNode(inner, source, filePath, mapper, results);
      break;
    }

    case 'ExportNamedDeclaration':
    case 'ExportDeclaration': {
      const inner = node.declaration ?? node.decl;
      if (inner) walkNode(inner, source, filePath, mapper, results);
      break;
    }

    case 'ClassDeclaration': {
      const body: AstNode[] = node.body ?? [];
      for (const member of body) {
        if (member.type === 'ClassMethod' || member.type === 'Constructor') {
          const methodName = member.key?.value ?? member.key?.raw ?? 'constructor';
          const className = node.identifier?.value ?? 'Anonymous';
          const fullName = `${className}.${methodName}`;
          const span = member.span as { start: number; end: number };
          const loc = mapper.getLocation(span.start);
          const fn = member.function ?? member;
          const params: AstNode[] = fn.params ?? [];
          const parsedParams = params.map((p: AstNode) => {
            const paramNode = p.pat ?? p.param ?? p;
            return extractParamType(paramNode, source);
          });
          const returnType = extractReturnType(fn, source);
          const jsdoc = extractJsDoc(source, span.start);
          const sourcePreview = getSourcePreview(source, span.start);
          results.push({
            id: generateId(filePath, fullName, loc.line),
            name: fullName,
            filePath,
            line: loc.line,
            column: loc.column,
            params: parsedParams,
            returnType,
            jsdoc,
            sourcePreview,
            lastModified: Date.now(),
            category: categorize(fullName, filePath, !!fn.async, true),
          });
        }
      }
      break;
    }
  }
}

function collectCallsInBody(node: unknown, calls: Set<string>): void {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const item of node) {
      collectCallsInBody(item, calls);
    }
    return;
  }

  const obj = node as Record<string, unknown>;

  if (obj.type === 'CallExpression') {
    const callee = obj.callee as Record<string, unknown> | undefined;
    if (callee) {
      if (callee.type === 'Identifier') {
        calls.add(callee.value as string);
      } else if (callee.type === 'MemberExpression') {
        const prop = callee.property as Record<string, unknown> | undefined;
        if (prop?.value) calls.add(prop.value as string);
      }
    }
  }

  for (const key of Object.keys(obj)) {
    if (key === 'span' || key === 'type') continue;
    collectCallsInBody(obj[key], calls);
  }
}

function extractCallEdges(
  functions: FunctionInfo[],
  body: AstNode[],
  filePath: string,
): DataFlowEdge[] {
  const nameToId = new Map<string, string>();
  for (const fn of functions) {
    // For class methods like "Foo.bar", index by the short name "bar" as well
    nameToId.set(fn.name, fn.id);
  }

  const edges: DataFlowEdge[] = [];

  for (const node of body) {
    // Determine which function(s) this top-level node declares
    const fnEntries: { name: string; bodyNode: unknown }[] = [];

    const unwrapped =
      node.type === 'ExportNamedDeclaration' || node.type === 'ExportDeclaration'
        ? (node.declaration ?? node.decl ?? node)
        : node.type === 'ExportDefaultDeclaration'
          ? (node.decl ?? node)
          : node;

    const inner = unwrapped as AstNode;

    switch (inner.type) {
      case 'FunctionDeclaration': {
        const name = inner.identifier?.value ?? inner.id?.value;
        if (name) fnEntries.push({ name, bodyNode: inner.body });
        break;
      }
      case 'VariableDeclaration': {
        const declarations: AstNode[] = inner.declarations ?? [];
        for (const decl of declarations) {
          if (
            decl.type === 'VariableDeclarator' &&
            decl.init &&
            decl.id?.value &&
            (decl.init.type === 'ArrowFunctionExpression' ||
              decl.init.type === 'FunctionExpression')
          ) {
            fnEntries.push({ name: decl.id.value, bodyNode: decl.init.body });
          }
        }
        break;
      }
      case 'ClassDeclaration': {
        const className = inner.identifier?.value ?? 'Anonymous';
        const bodyMembers: AstNode[] = inner.body ?? [];
        for (const member of bodyMembers) {
          if (member.type === 'ClassMethod' || member.type === 'Constructor') {
            const methodName = member.key?.value ?? member.key?.raw ?? 'constructor';
            const fullName = `${className}.${methodName}`;
            const fn = member.function ?? member;
            fnEntries.push({ name: fullName, bodyNode: fn.body });
          }
        }
        break;
      }
    }

    for (const { name, bodyNode } of fnEntries) {
      const callerId = nameToId.get(name);
      if (!callerId) continue;

      const calls = new Set<string>();
      collectCallsInBody(bodyNode, calls);

      for (const calleeName of calls) {
        const calleeId = nameToId.get(calleeName);
        if (calleeId && calleeId !== callerId) {
          edges.push({
            sourceId: callerId,
            targetId: calleeId,
            label: calleeName,
            edgeType: 'call',
            filePath,
          });
        }
      }
    }
  }

  return edges;
}

function findFirstCodeOffset(source: string): number {
  let i = 0;
  while (i < source.length) {
    const c = source.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10 || c === 13) { i++; continue; }
    if (source[i] === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (source[i] === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i - 1] === '*' && source[i] === '/')) i++;
      if (i < source.length) i++;
      continue;
    }
    break;
  }
  return i;
}

function normalizeSpans(node: unknown, base: number): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) normalizeSpans(item, base);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj.span && typeof obj.span === 'object') {
    const span = obj.span as Record<string, number>;
    if (typeof span.start === 'number') span.start -= base;
    if (typeof span.end === 'number') span.end -= base;
  }
  for (const key of Object.keys(obj)) {
    if (key === 'type' || key === 'span') continue;
    normalizeSpans(obj[key], base);
  }
}

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const RESOLVE_INDEX = RESOLVE_EXTENSIONS.map((ext) => `/index${ext}`);

function resolveImportPath(fromFile: string, importSource: string): string | null {
  // Only resolve relative imports — skip bare specifiers (node_modules packages)
  if (!importSource.startsWith('.')) return null;

  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, importSource);

  // Try exact path first (already has extension)
  if (existsSync(resolved) && !resolved.endsWith('/')) {
    // Make sure it's a file, not a directory — if it has an extension it's likely a file
    const ext = path.extname(resolved);
    if (ext) return resolved;
  }

  // Try adding extensions
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = resolved + ext;
    if (existsSync(candidate)) return candidate;
  }

  // Try as directory with index file
  for (const idx of RESOLVE_INDEX) {
    const candidate = resolved + idx;
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function formatSpecifiers(specifiers: AstNode[]): string {
  if (!specifiers || specifiers.length === 0) return '*';

  const names: string[] = [];
  for (const spec of specifiers) {
    switch (spec.type) {
      case 'ImportDefaultSpecifier':
        names.push(spec.local?.value ?? 'default');
        break;
      case 'ImportNamespaceSpecifier':
        names.push(`* as ${spec.local?.value ?? '?'}`);
        break;
      case 'ImportSpecifier': {
        const imported = spec.imported?.value ?? spec.local?.value;
        const local = spec.local?.value;
        if (imported && local && imported !== local) {
          names.push(`${imported} as ${local}`);
        } else {
          names.push(imported ?? local ?? '?');
        }
        break;
      }
    }
  }

  if (names.length === 0) return '*';
  // If there's a default import mixed with named imports, format accordingly
  const defaultImport = specifiers.find((s) => s.type === 'ImportDefaultSpecifier');
  const namedImports = names.filter((_, i) => specifiers[i]?.type !== 'ImportDefaultSpecifier');
  if (defaultImport && namedImports.length > 0) {
    return `${defaultImport.local?.value}, { ${namedImports.join(', ')} }`;
  }
  if (namedImports.length > 0 && !defaultImport) {
    return `{ ${namedImports.join(', ')} }`;
  }
  return names.join(', ');
}

function extractImportEdges(body: AstNode[], filePath: string): DataFlowEdge[] {
  const edges: DataFlowEdge[] = [];
  for (const item of body) {
    if (item.type === 'ImportDeclaration') {
      const source = item.source?.value as string | undefined;
      if (!source) continue;
      const resolved = resolveImportPath(filePath, source);
      if (!resolved) continue;
      edges.push({
        sourceId: filePath,
        targetId: resolved,
        edgeType: 'import',
        label: formatSpecifiers(item.specifiers ?? []),
      });
    }
  }
  return edges;
}

export async function parseFile(filePath: string): Promise<{ functions: FunctionInfo[]; edges: DataFlowEdge[] }> {
  const source = await readFile(filePath, 'utf-8');
  const isTsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');

  const module = parseSync(source, {
    syntax: 'typescript',
    tsx: isTsx,
    comments: true,
  });

  const spanBase = module.span.start - findFirstCodeOffset(source);
  if (spanBase !== 0) normalizeSpans(module, spanBase);

  const mapper = new SourceMapper(source);
  const results: FunctionInfo[] = [];

  for (const node of module.body) {
    walkNode(node as AstNode, source, filePath, mapper, results);
  }

  const callEdges = extractCallEdges(results, module.body as AstNode[], filePath);
  const importEdges = extractImportEdges(module.body as AstNode[], filePath);
  const edges = [...callEdges, ...importEdges];

  return { functions: results, edges };
}
