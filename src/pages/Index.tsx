import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { tools as allTools, type AITool } from '@/data/tools';
import { usePosture } from '@/context/PostureContext';
import { PROFILE_LABELS, type ApprovalStatus, type ToolScore } from '@/lib/posture';
import { ProfileToggle } from '@/components/ProfileToggle';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { CompareModal } from '@/components/CompareModal';
import { CATEGORY_GROUPS, filterCatalog, inCategoryGroup, matchesSearch, type CategoryGroup } from '@/lib/catalogFilter';
import { toast } from 'sonner';
import { ThreatFeedTerminal } from '@/components/ThreatFeedTerminal';
import { TelemetryStream } from '@/components/TelemetryStream';
import { SystemStatus } from '@/components/SystemStatus';
import { IncidentsSheet } from '@/components/IncidentsSheet';
import { PolicyWeightsDrawer } from '@/components/PolicyWeightsDrawer';
import { BoardReportDrawer } from '@/components/BoardReportDrawer';
import { Search, Shield, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type Filter = 'all' | ApprovalStatus;

const METRIC_LABEL: Record<string, string> = {
  perf: 'Performance', sov: 'Data Sovereignty', priv: 'Training Privacy', sec: 'Security & Compliance', owasp: 'OWASP Risk',
};
const METRIC_FIELD: Record<string, keyof ToolScore> = {
  perf: 'perfScore', sov: 'sovScore', priv: 'privScore', sec: 'secScore', owasp: 'owaspScore',
};

const GRADE_CLS: Record<string, string> = {
  A: 'text-safe', B: 'text-safe', C: 'text-warning', D: 'text-danger',
};

function PostureBadge() {
  const { posture } = usePosture();
  return (
    <div className="flex items-center gap-2.5 rounded-full bg-secondary/60 pl-3 pr-1 py-1" aria-live="polite">
      <span className="text-[11px] text-muted-foreground font-medium">Approved Posture</span>
      <span className="flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-0.5">
        <motion.span key={posture?.grade ?? '-'} initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cn('font-black text-sm', posture ? GRADE_CLS[posture.grade] : 'text-muted-foreground')}>
          {posture?.grade ?? '–'}
        </motion.span>
        <motion.span key={posture?.score ?? 0} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-mono text-xs text-foreground">
          {posture ? `${posture.score}/100` : 'no approved tools'}
        </motion.span>
      </span>
    </div>
  );
}

const Index = () => {
  const { profile, setProfile, statuses, scores, isCustomWeights } = usePosture();
  const [compareList, setCompareList] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [driver, setDriver] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryGroup>('all');
  const [compareOpen, setCompareOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses the search bar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Detect which metric drove the score shift after a profile change
  const snap = useRef({ profile, scores });
  useEffect(() => {
    if (snap.current.profile !== profile) {
      const prev = snap.current.scores;
      let best: string | null = null;
      let bestDelta = 0;
      for (const key of Object.keys(METRIC_FIELD)) {
        const f = METRIC_FIELD[key];
        const d = allTools.reduce((sum, t) => sum + Math.abs((scores[t.id][f] as number) - (prev[t.id][f] as number)), 0) / allTools.length;
        if (d > bestDelta) { bestDelta = d; best = key; }
      }
      setDriver(best);
      const t = setTimeout(() => setDriver(null), 3200);
      snap.current = { profile, scores };
      return () => clearTimeout(t);
    }
    snap.current = { profile, scores };
  }, [profile, scores]);

  const handleCompare = (tool: AITool) => {
    const prev = compareList;
    let next: string[];
    if (prev.includes(tool.id)) next = prev.filter((id) => id !== tool.id);
    else if (prev.length >= 2) next = [prev[1], tool.id];
    else next = [...prev, tool.id];
    setCompareList(next);
    // Pop the comparison open the moment a pair is ready
    if (next.length === 2 && !prev.includes(tool.id)) setCompareOpen(true);
  };

  const clearCompare = () => { setCompareList([]); setCompareOpen(false); };

  const openCompare = () => {
    if (compareList.length < 2) {
      toast('Pick one more tool', { description: 'Expand any row and choose "Add to VS" to complete the pair.' });
      return;
    }
    setCompareOpen(true);
  };

  const compareTools = compareList.length === 2
    ? ([allTools.find((t) => t.id === compareList[0])!, allTools.find((t) => t.id === compareList[1])!] as [AITool, AITool])
    : null;

  const counts = useMemo(() => ({
    all: allTools.length,
    approved: allTools.filter((t) => statuses[t.id] === 'approved').length,
    review: allTools.filter((t) => statuses[t.id] === 'review').length,
    banned: allTools.filter((t) => statuses[t.id] === 'banned').length,
  }), [statuses]);

  const tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: `All Tools (${counts.all})` },
    { id: 'approved', label: `Approved Catalog (${counts.approved})` },
    { id: 'review', label: `Under Review (${counts.review})` },
    { id: 'banned', label: `Banned (${counts.banned})` },
  ];

  const byStatus = filter === 'all' ? allTools : allTools.filter((t) => statuses[t.id] === filter);
  const visible = filterCatalog(byStatus, query, category);
  const searched = byStatus.filter((t) => matchesSearch(t, query));
  const categoryCounts = Object.fromEntries(
    CATEGORY_GROUPS.map((g) => [g.id, searched.filter((t) => inCategoryGroup(t, g.id)).length]),
  ) as Record<CategoryGroup, number>;
  const compareNames = compareList.map((id) => allTools.find((t) => t.id === id)?.name).filter(Boolean).join(' vs ');

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      <header className="shrink-0 z-40 header-glass">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center glow-safe">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="leading-tight">
              <h1 className="text-lg font-bold gradient-text">Vigilance AI</h1>
              <p className="text-[11px] text-muted-foreground">AI Security Posture Management</p>
            </div>
          </div>

          <div className="order-last w-full flex justify-center xl:order-none xl:w-auto">
            <ProfileToggle active={profile} onChange={setProfile} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AnimatePresence>
              {compareList.length > 0 && (
                <motion.div
                  key="compare-actions"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-1"
                >
                  <button
                    onClick={openCompare}
                    title={compareNames}
                    aria-disabled={compareList.length < 2}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors',
                      compareList.length === 2
                        ? 'bg-primary/15 text-primary border-primary/50 glow-safe animate-pulse-glow hover:bg-primary/25'
                        : 'bg-secondary/60 text-foreground border-glass-border hover:bg-secondary',
                    )}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Compare Selected ({compareList.length}/2)
                  </button>
                  <button onClick={clearCompare} className="header-chip !px-2.5" aria-label="Clear comparison selection">
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <PostureBadge />
            <IncidentsSheet />
            <PolicyWeightsDrawer />
            <BoardReportDrawer />
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full max-w-[1600px] mx-auto px-4 py-3 grid gap-4 grid-rows-[minmax(0,1fr)_minmax(0,2.2fr)] lg:grid-rows-1 lg:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]">
        {/* Left pane — threat intel & telemetry */}
        <aside className="flex flex-col gap-3 min-h-0 overflow-y-auto lg:overflow-hidden">
          <div className="shrink-0"><SystemStatus /></div>
          <ThreatFeedTerminal className="h-[320px] shrink-0 lg:h-auto lg:shrink lg:flex-[3] lg:min-h-0" />
          <TelemetryStream className="h-[240px] shrink-0 lg:h-auto lg:shrink lg:flex-[2] lg:min-h-0" />
        </aside>

        {/* Right pane — leaderboard & posture */}
        <section className="flex flex-col gap-3 min-h-0 min-w-0">
          <motion.div
            key={profile}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
          >
            <Zap className="w-4 h-4 text-primary" />
            <span>
              Scored for <span className="text-primary font-semibold">{PROFILE_LABELS[profile]}</span>
              {isCustomWeights && <span className="text-foreground"> · custom policy</span>}
            </span>
            <AnimatePresence>
              {driver && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5"
                >
                  Shift driven by {METRIC_LABEL[driver]}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>

          <div className="shrink-0 flex flex-wrap items-end gap-x-3 gap-y-2 border-b border-border">
          <div role="tablist" aria-label="Catalog filter" className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={filter === t.id}
                onClick={() => setFilter(t.id)}
                className={cn('relative px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors', filter === t.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {t.label}
                {filter === t.id && (
                  <motion.span layoutId="filter-underline" className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                )}
              </button>
            ))}
          </div>
            <div className="relative ml-auto w-full sm:w-64 xl:w-80 mb-1.5">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); } }}
                placeholder="Search models, vendors, or capabilities..."
                aria-label="Search models, vendors, or capabilities"
                className="w-full h-8 rounded-lg bg-secondary/50 border border-glass-border pl-8 pr-14 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/60 focus:bg-secondary/80 focus:ring-2 focus:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <button onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none rounded border border-glass-border bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
              )}
            </div>
          </div>

          <div role="group" aria-label="Category filter" className="shrink-0 flex gap-1.5 overflow-x-auto pb-0.5">
            {CATEGORY_GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setCategory(g.id)}
                aria-pressed={category === g.id}
                className={cn(
                  'shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors',
                  category === g.id
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'bg-secondary/40 text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/70',
                )}
              >
                {g.label}
                <span className="font-mono text-[10px] opacity-70">{categoryCounts[g.id]}</span>
              </button>
            ))}
          </div>

          <LeaderboardTable tools={visible} onCompare={handleCompare} compareSelected={compareList} driver={driver} className="flex-1" />
        </section>
      </main>

      <CompareModal tools={compareTools} open={compareOpen} onOpenChange={setCompareOpen} onClear={clearCompare} />

      <footer className="shrink-0 border-t border-border">
        <div className="max-w-[1600px] mx-auto px-4 py-1.5 text-center text-[10px] text-muted-foreground truncate">
          Vigilance AI — Tool posture from public vendor policies; vulnerabilities live from NVD &amp; OSV.dev. Telemetry and policy-watch events are simulated.
        </div>
      </footer>
    </div>
  );
};

export default Index;
