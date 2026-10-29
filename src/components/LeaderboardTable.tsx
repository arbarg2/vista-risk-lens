import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AITool } from '@/data/tools';
import { usePosture } from '@/context/PostureContext';
import { ScoreRing } from './ScoreRing';
import { Sparkline } from './Sparkline';
import { FlashCell } from './FlashCell';
import { StatusSelect } from './StatusSelect';
import { ExpandedToolPanel } from './ExpandedToolPanel';
import { CheckCircle2, ChevronDown, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeaderboardTableProps {
  tools: AITool[];
  onCompare: (tool: AITool) => void;
  compareSelected: string[];
  /** Metric key that drove the last profile shift, highlighted in the header. */
  driver?: string | null;
  className?: string;
}

const GRID = 'grid grid-cols-[1.75rem_minmax(9rem,1fr)_7.75rem_3.25rem_4.75rem_2.75rem_2.75rem_2.75rem_2.75rem_3.5rem_1rem] gap-2 items-center';

const COLS: { key: string; label: string; title: string }[] = [
  { key: 'perf', label: 'Perf', title: 'Performance (accuracy, latency, throughput)' },
  { key: 'sov', label: 'Sov', title: 'Data Sovereignty' },
  { key: 'priv', label: 'Priv', title: 'Training Privacy' },
  { key: 'sec', label: 'Sec', title: 'Security & Compliance' },
  { key: 'owasp', label: 'OWASP', title: 'OWASP LLM Top 10 resilience' },
];

export function LeaderboardTable({ tools, onCompare, compareSelected, driver, className }: LeaderboardTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { scores, statuses, setStatus, weights } = usePosture();
  const weightSum = weights.performance + weights.sovereignty + weights.privacy + weights.security + weights.owasp;
  const perfPct = weightSum > 0 ? Math.round((weights.performance / weightSum) * 100) : 0;
  const trustPct = weightSum > 0 ? 100 - perfPct : 0;

  const sorted = [...tools].sort((a, b) => scores[b.id].total - scores[a.id].total);

  return (
    <div className={cn('glass-card-elevated overflow-hidden flex flex-col min-h-0', className)}>
      <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
        <div className="min-w-[760px]">
          <div className="sticky top-0 z-20 bg-card border-b border-border">
          <div className={cn(GRID, 'px-4 pt-2.5 text-[9px] font-semibold uppercase tracking-wider')} aria-hidden>
            <span className="col-span-4" />
            <div className="flex flex-col items-center gap-1 text-primary" title="Share of the total score from Performance under the current policy">
              <span className="leading-none whitespace-nowrap">Performance <span className="font-mono">{perfPct}%</span></span>
              <span className="w-full h-0.5 rounded-full bg-primary/70" />
            </div>
            <div className="col-span-4 flex flex-col items-center gap-1 text-safe" title="Share of the total score from Trust metrics under the current policy">
              <span className="leading-none whitespace-nowrap">Trust Metrics <span className="font-mono">{trustPct}%</span></span>
              <span className="w-full h-0.5 rounded-full bg-safe/40" />
            </div>
            <span className="col-span-2" />
          </div>
          <div className={cn(GRID, 'px-4 pt-1.5 pb-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider')}>
            <span>#</span>
            <span>Model</span>
            <span>Status</span>
            <span className="text-center">Score</span>
            {COLS.map((c) => (
              <span
                key={c.key}
                title={c.title}
                className={cn('text-center rounded transition-colors duration-500', c.key === 'sov' && 'border-l border-border/60', driver === c.key && 'text-primary bg-primary/10')}
              >
                {c.label}
              </span>
            ))}
            <span className="text-center">Trend</span>
            <span />
          </div>
          </div>

          {sorted.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">No tools match this view. Try a different search or filter.</div>
          )}

          {sorted.map((tool, idx) => {
            const s = scores[tool.id];
            const isExpanded = expanded === tool.id;
            const inCompare = compareSelected.includes(tool.id);
            return (
              <motion.div key={tool.id} layout transition={{ type: 'spring', stiffness: 500, damping: 40 }} className="border-b border-border/50 last:border-b-0">
                <div
                  onClick={() => setExpanded(isExpanded ? null : tool.id)}
                  className={cn(
                    GRID,
                    'px-4 py-3 cursor-pointer transition-colors hover:bg-secondary/40 outline-none focus-visible:bg-secondary/40',
                    inCompare && 'bg-primary/5 shadow-[inset_2px_0_0_hsl(var(--primary))]',
                  )}
                >
                  <span className="font-mono text-xs text-muted-foreground">{idx + 1}</span>

                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg leading-none">{tool.logo}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-foreground truncate">{tool.name}</span>
                        {tool.verified && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" aria-label="SOC2 documentation verified" />}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="truncate">{tool.provider} · {tool.category}</span>
                        {s.cvePenalty > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded px-1 bg-danger/10 text-danger font-mono text-[10px] shrink-0" title="Trust reduced by live CVEs in this tool's dependency stack">
                            <ShieldAlert className="w-2.5 h-2.5" />−{s.cvePenalty}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <StatusSelect value={statuses[tool.id]} onChange={(v) => setStatus(tool.id, v)} toolName={tool.name} />
                  </div>

                  <div className="flex justify-center">
                    <ScoreRing score={s.total} size={40} strokeWidth={3} />
                  </div>

                  <FlashCell value={s.perfScore} className="text-foreground" />
                  <FlashCell value={s.sovScore} className="text-foreground" />
                  <FlashCell value={s.privScore} className="text-foreground" />
                  <FlashCell value={s.secScore} className="text-foreground" />
                  <FlashCell value={s.owaspScore} className="text-foreground" />

                  <div className="flex justify-center">
                    <Sparkline data={tool.trendData} />
                  </div>

                  <button
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${tool.name}`}
                    onClick={(e) => { e.stopPropagation(); setExpanded(isExpanded ? null : tool.id); }}
                    className="rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28 }}
                      className="overflow-hidden border-t border-border/60"
                    >
                      <ExpandedToolPanel tool={tool} score={s} onCompare={() => onCompare(tool)} inCompare={inCompare} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
