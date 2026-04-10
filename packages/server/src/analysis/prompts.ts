import type { FunctionInfo, DataFlowEdge } from '@agent-monitor/types';

export function buildAnalysisPrompt(opts: {
  targetFunctions: FunctionInfo[];
  neighbors: FunctionInfo[];
  edges: DataFlowEdge[];
  taskName: string;
}): string {
  const { targetFunctions, neighbors, edges, taskName } = opts;

  const taskInstructions = getTaskInstructions(taskName);

  const targetSection = targetFunctions.map((fn) => {
    return `### ${fn.name} (${fn.filePath}:${fn.line})
ID: ${fn.id}
Category: ${fn.category}
Params: ${fn.params.map((p) => `${p.name}: ${p.type}`).join(', ') || 'none'}
Return type: ${fn.returnType}
Source:
\`\`\`
${fn.sourcePreview}
\`\`\``;
  }).join('\n\n');

  const neighborSection = neighbors.length > 0
    ? neighbors.map((fn) => {
        return `- ${fn.name} (${fn.filePath}:${fn.line}) [${fn.category}] params: (${fn.params.map((p) => `${p.name}: ${p.type}`).join(', ')}) -> ${fn.returnType}`;
      }).join('\n')
    : 'No direct neighbors found.';

  const edgeSection = edges.length > 0
    ? edges.map((e) => `- ${e.sourceId} -[${e.edgeType}: ${e.label}]-> ${e.targetId}`).join('\n')
    : 'No edges.';

  const fileContext = [...new Set(targetFunctions.map((f) => f.filePath))].join('\n  ');

  return `You are a code analysis agent. Analyze the following functions and provide structured feedback.

## Task: ${taskName}

${taskInstructions}

## Target Functions

${targetSection}

## Call Graph Neighbors (1-hop)

${neighborSection}

## Edges

${edgeSection}

## File Context

Files involved:
  ${fileContext}

## Output Format

Respond with ONLY valid JSON matching this exact shape (no markdown, no explanation):

{
  "results": [
    {
      "functionId": "<the function id>",
      "summary": "<one-line summary>",
      "details": "<detailed analysis paragraph>",
      "concerns": [
        { "severity": "info|warning|critical", "description": "<description>", "line": <optional line number or null> }
      ],
      "integrationNotes": ["<note about how this function fits into the codebase>"]
    }
  ]
}

Provide one entry in "results" for each target function listed above. The functionId must match exactly.`;
}

function getTaskInstructions(taskName: string): string {
  switch (taskName) {
    case 'change-summary':
      return `Summarize what each function does and what recently changed. Focus on the purpose, behavior, and any notable design decisions. Keep concerns minimal unless something is clearly wrong.`;

    case 'data-flow-trace':
      return `Trace how data flows through the call chain involving each target function. Identify what data enters, how it is transformed, and where it goes. Flag any places where data might be lost, silently coerced, or leak between boundaries.`;

    case 'drift-detection':
      return `Compare each target function against the neighbor functions provided and detect codebase drift. Specifically:

1. **Duplication**: Identify if the function duplicates existing functionality — same logic under a different name. If an exact duplicate exists, flag as critical severity.
2. **Pattern violations**: Flag if the function contradicts established patterns in the codebase, such as a different error handling style, inconsistent naming conventions, or a different abstraction level compared to its neighbors. Flag as warning severity.
3. **Dead code**: Check for dead code or unreachable paths within the function. Flag as warning severity.
4. **Style inconsistencies**: Note minor style inconsistencies (formatting, naming case) as info severity.

Severity guide for concerns:
- \`critical\`: exact duplicate of an existing function (same logic, different name)
- \`warning\`: partial overlap with another function, pattern violation, or dead code
- \`info\`: minor style inconsistency

Be thorough in comparing against every neighbor function provided.`;

    case 'function-review':
    default:
      return `Review each function for correctness, potential bugs, error handling gaps, performance issues, and code quality. Be specific about concerns and include line numbers when possible. Also note how each function integrates with its neighbors in the call graph.`;
  }
}
