import { useEffect, useRef, useState } from 'react';
import { usePosture, type FeedLine, type FeedTag } from '@/context/PostureContext';
import { cn } from '@/lib/utils';

const LEVEL_CLS: Record<FeedLine['level'], string> = {
  critical: 'text-danger',
  high: 'text-warning',
  medium: 'text-foreground/85',
  low: 'text-muted-foreground',
  info: 'text-muted-foreground',
};

const TAG_CLS: Record<FeedTag, string> = {
  CVE: 'bg-danger/15 text-danger',
  'POLICY UPDATE': 'bg-warning/15 text-warning',
  SYS: 'bg-primary/10 text-primary',
};

const FILTERS: { id: 'all' | FeedTag; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'CVE', label: 'CVE' },
  { id: 'POLICY UPDATE', label: 'POLICY' },
  { id: 'SYS', label: 'SYS' },
];

const hhmmss = (ts: number) => new Date(ts).toTimeString().slice(0, 8);

export function ThreatFeedTerminal({ className }: { className?: string }) {
  const { feed, sources } = usePosture();
  const [filter, setFilter] = useState<'all' | FeedTag>('all');
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const lines = filter === 'all' ? feed : feed.filter((l) => l.tag === filter);
  const live = sources.NVD.state === 'live' || sources.OSV.state === 'live' || sources.NVD.state === 'loading';

  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <section className={cn('terminal flex flex-col min-h-0 overflow-hidden', className)} aria-label="Live threat feed">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/70">
        <span className="flex gap-1.5" aria-hidden>
          <span className="w-2.5 h-2.5 rounded-full bg-danger/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-warning/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-safe/70" />
        </span>
        <span className="font-mono text-[11px] text-muted-foreground tracking-wide truncate">TAIL -F /VAR/LOG/AI-THREAT-FEED</span>
        <span className={cn('ml-auto flex items-center gap-1.5 font-mono text-[10px] shrink-0', live ? 'text-safe' : 'text-muted-foreground')}>
          <span className={cn('w-1.5 h-1.5 rounded-full', live ? 'bg-safe animate-pulse' : 'bg-muted-foreground')} />
          {sources.NVD.state === 'loading' || sources.OSV.state === 'loading' ? 'SYNCING' : live ? 'LIVE' : sources.NVD.state === 'cached' ? 'CACHED' : 'OFFLINE'}
        </span>
      </div>
      <div className="flex gap-1 px-3 py-1.5 border-b border-border/40">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn('font-mono text-[10px] px-2 py-0.5 rounded transition-colors', filter === f.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
      >
        {lines.map((l) => (
          <div key={l.id} className="flex gap-2 py-0.5 animate-fade-in">
            <span className="text-muted-foreground/70 shrink-0">{hhmmss(l.ts)}</span>
            <span className={cn('shrink-0 px-1 rounded text-[9px] font-semibold h-fit mt-0.5', TAG_CLS[l.tag])}>{l.tag}</span>
            <span className={cn('min-w-0 break-words', LEVEL_CLS[l.level])}>
              {l.url ? (
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{l.text}</a>
              ) : (
                l.text
              )}
              {l.source && <span className="text-muted-foreground/60"> · {l.source}</span>}
              {l.simulated && <span className="text-muted-foreground/60"> · sim</span>}
            </span>
          </div>
        ))}
        <div className="flex gap-2 py-0.5 text-primary">
          <span>$</span><span className="w-2 h-3.5 bg-primary animate-pulse-glow mt-0.5" />
        </div>
      </div>
    </section>
  );
}
