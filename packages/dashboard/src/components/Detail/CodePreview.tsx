interface CodePreviewProps {
  code: string;
  startLine?: number;
}

export function CodePreview({ code, startLine = 1 }: CodePreviewProps) {
  const lines = code.split('\n');

  return (
    <pre className="bg-surface rounded-lg p-4 overflow-x-auto text-xs">
      <code>
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="text-text-muted select-none w-8 text-right mr-3 shrink-0">
              {startLine + i}
            </span>
            <span className="text-text-primary">{line}</span>
          </div>
        ))}
      </code>
    </pre>
  );
}
