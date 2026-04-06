'use client';

interface SidebarTabsProps {
  active: 'files' | 'commits';
  onChange: (tab: 'files' | 'commits') => void;
}

const tabs: { key: 'files' | 'commits'; label: string }[] = [
  { key: 'files', label: 'Files' },
  { key: 'commits', label: 'Commits' },
];

export function SidebarTabs({ active, onChange }: SidebarTabsProps) {
  return (
    <div className="flex border-b border-border-subtle">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`text-[10px] font-medium uppercase tracking-[0.12em] px-3 py-2.5 transition-colors ${
            active === tab.key
              ? 'text-text border-b-2 border-signal'
              : 'text-text-dim hover:text-text-secondary'
          }`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
