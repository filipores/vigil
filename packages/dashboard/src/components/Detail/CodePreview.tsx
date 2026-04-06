interface CodePreviewProps {
  code: string;
  startLine?: number;
}

export function CodePreview({ code, startLine = 1 }: CodePreviewProps) {
  const lines = code.split('\n');

  return (
    <pre className="bg-void rounded-md p-3 overflow-x-auto text-[11px] leading-[1.6] border border-border-subtle">
      <code>
        {lines.map((line, i) => (
          <div key={i} className="flex hover:bg-surface-raised/30 -mx-1 px-1 rounded-sm transition-colors">
            <span className="font-mono text-text-dim select-none w-7 text-right mr-3 shrink-0 tabular-nums">
              {startLine + i}
            </span>
            <span className="font-mono text-text-secondary">{line || ' '}</span>
          </div>
        ))}
      </code>
    </pre>
  );
}
