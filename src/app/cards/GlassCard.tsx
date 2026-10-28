import { type ReactNode, type Ref, useId } from 'react';

interface GlassCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  cardRef?: Ref<HTMLElement>;
}

/** Shared shell of the content cards: glass material, sticky title row, padded body. */
export function GlassCard({
  title,
  subtitle,
  action,
  children,
  className,
  cardRef,
}: GlassCardProps) {
  const titleId = `card-${useId().replace(/:/g, '')}`;
  return (
    <section
      ref={cardRef}
      aria-labelledby={titleId}
      className={className ? `glass ${className}` : 'glass'}
    >
      <header
        data-card-header
        className="sticky top-[var(--hero-collapsed-h,0px)] z-10 flex items-start justify-between gap-3 px-4 pt-4"
      >
        <div className="min-w-0">
          <h2 id={titleId} className="m-0 text-[15px] font-semibold leading-5 text-text">
            {title}
          </h2>
          {subtitle ? (
            <p className="m-0 text-[13px] font-normal leading-[18px] text-text-muted">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div data-card-body className="p-4">
        {children}
      </div>
    </section>
  );
}
