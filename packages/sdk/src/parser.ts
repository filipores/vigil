import { readFile } from 'node:fs/promises';
import { parseSync } from '@swc/core';
import type { FunctionInfo } from '@agent-monitor/types';
import { generateId } from './utils.js';
import { extractJsDoc, extractParamType, extractReturnType, SourceMapper } from './extractor.js';

function getSourcePreview(source: string, startOffset: number, maxLines: number = 15): string {
  const rest = source.slice(startOffset);
  const lines = rest.split('\n').slice(0, maxLines);
  return lines.join('\n');
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
          });
        }
      }
      break;
    }
  }
}

export async function parseFile(filePath: string): Promise<FunctionInfo[]> {
  const source = await readFile(filePath, 'utf-8');
  const isTsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');

  const module = parseSync(source, {
    syntax: 'typescript',
    tsx: isTsx,
    comments: true,
  });

  const mapper = new SourceMapper(source);
  const results: FunctionInfo[] = [];

  for (const node of module.body) {
    walkNode(node as AstNode, source, filePath, mapper, results);
  }

  return results;
}
