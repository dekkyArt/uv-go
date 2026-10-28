import { useId } from 'react';
import type { ComponentType } from 'react';
import { rules } from '../../domain/rules.config';
import type { Activity, ChecklistId, ChecklistItem, TimeWindow } from '../../domain/types';
import { HatSunglasses } from '../icons/checklist/HatSunglasses';
import { RainJacket } from '../icons/checklist/RainJacket';
import type { IconProps } from '../icons/checklist/shared';
import { Sunscreen } from '../icons/checklist/Sunscreen';
import { WarmLayer } from '../icons/checklist/WarmLayer';
import { Water } from '../icons/checklist/Water';
import { tileReason } from './tileReason';

interface Props {
  items: ChecklistItem[];
  /** The best window: the reason lines are read from its hours. */
  window: TimeWindow;
  activity: Activity;
  /** Reserved for the first-result choreography; the tiles have no intro motion yet. */
  intro: boolean;
}

const ICONS: Record<ChecklistId, ComponentType<IconProps>> = {
  sunscreen: Sunscreen,
  'hat-sunglasses': HatSunglasses,
  'rain-jacket': RainJacket,
  water: Water,
  'warm-layer': WarmLayer,
};

function Tile({
  item,
  window,
  activity,
}: Omit<Props, 'items' | 'intro'> & { item: ChecklistItem }) {
  const Icon = ICONS[item.id];
  const { title, detail } = tileReason(item.id, window, activity);
  return (
    <li className="glass flex aspect-square min-w-0 flex-col justify-between p-3.5">
      <div className="flex items-center gap-1.5 text-text">
        <Icon play={false} />
        <span className="text-[13px] font-semibold uppercase leading-4 tracking-wide">
          {item.label}
        </span>
      </div>
      <div>
        <p className="m-0 text-[22px] font-semibold leading-7 text-text">{title}</p>
        <p className="m-0 mt-1 text-[13px] leading-[18px] text-text-muted">{detail}</p>
      </div>
    </li>
  );
}

export function TakeTiles({ items, window, activity }: Props) {
  const headingId = `take-${useId().replace(/:/g, '')}`;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        What to take
      </h2>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
        {items.length === 0 ? (
          <li className="glass col-span-2 p-4 text-[15px] leading-5 text-text">
            {rules.emptyChecklistText}
          </li>
        ) : (
          items.map((item) => (
            <Tile key={item.id} item={item} window={window} activity={activity} />
          ))
        )}
      </ul>
    </section>
  );
}
