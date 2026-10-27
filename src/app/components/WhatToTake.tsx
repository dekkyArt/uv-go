import { rules } from '../../domain/rules.config';
import type { ChecklistItem } from '../../domain/types';

interface Props {
  items: ChecklistItem[];
}

export function WhatToTake({ items }: Props) {
  return (
    <div>
      <h3 className="text-sm font-semibold">What to take</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-text-muted">{rules.emptyChecklistText}</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-full bg-surface-strong px-3 py-1 text-sm font-medium"
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
