'use client';

import { useMemo } from 'react';
import type { FunctionInfo, FunctionCategory } from '@agent-monitor/types';

interface CategoryFilterProps {
  functions: FunctionInfo[];
  selectedCategory: FunctionCategory | null;
  onSelectCategory: (category: FunctionCategory | null) => void;
}

export function CategoryFilter({ functions, selectedCategory, onSelectCategory }: CategoryFilterProps) {
  const categoryCounts = useMemo(() => {
    const counts = new Map<FunctionCategory, number>();
    for (const fn of functions) {
      counts.set(fn.category, (counts.get(fn.category) ?? 0) + 1);
    }
    return counts;
  }, [functions]);

  const categories = Array.from(categoryCounts.entries());

  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-border-subtle">
      <button
        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
          selectedCategory === null
            ? 'bg-signal/10 text-signal'
            : 'text-text-dim hover:bg-surface-raised/50'
        }`}
        onClick={() => onSelectCategory(null)}
      >
        all
      </button>
      {categories.map(([category, count]) => (
        <button
          key={category}
          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
            selectedCategory === category
              ? 'bg-signal/10 text-signal'
              : 'text-text-dim hover:bg-surface-raised/50'
          }`}
          onClick={() => onSelectCategory(category)}
        >
          {category} {count}
        </button>
      ))}
    </div>
  );
}
