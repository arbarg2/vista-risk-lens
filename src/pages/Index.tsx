import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { tools as allTools, type AITool } from '@/data/tools';
import { usePosture } from '@/context/PostureContext';
import { PROFILE_LABELS, type ApprovalStatus, type ToolScore } from '@/lib/posture';
import { ProfileToggle } from '@/components/ProfileToggle';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { ComparisonEngine } from '@/components/ComparisonEngine';
import { ThreatFeedTerminal } from '@/components/ThreatFeedTerminal';
import { TelemetryStream } from '@/components/TelemetryStream';
import { SystemStatus } from '@/components/SystemStatus';
import { IncidentsSheet } from '@/components/IncidentsSheet';
import { PolicyWeightsDrawer } from '@/components/PolicyWeightsDrawer';
import { BoardReportDrawer } from '@/components/BoardReportDrawer';
import { Shield, Zap } from 'lucide-react';
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
    setCompareList((prev) => {
      if (prev.includes(tool.id)) return prev.filter((id) => id !== tool.id);
      if (prev.length >= 2) return [prev[1], tool.id];
      return [...prev, tool.id];
    });
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

  const visible = filter === 'all' ? allTools : allTools.filter((t) => statuses[t.id] === filter);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 header-glass">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center glow-safe">
              <Shield className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="leading-tight">
              <h1 className="text-lg font-bold gradient-text">Vigilance AI</h1>
              <p className="text-[11px] text-muted-foreground">AI Security Posture Management</p>
            </div>
          </div>

          <div className="order-last w-full flex justify-center xl:order-none xl:w-auto">
            <ProfileToggle active={profile} onChange={setProfile} />
          </div>

          <div className="flex items-center gap-2">
            <PostureBadge />
            <IncidentsSheet />
            <PolicyWeightsDrawer />
            <BoardReportDrawer />
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-5 grid gap-5 lg:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]">
        {/* Left pane — threat intel & telemetry */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[5.5rem] lg:h-[calc(100vh-7rem)] min-h-0">
          <SystemStatus />
          <ThreatFeedTerminal className="h-[420px] lg:h-auto lg:flex-[3]" />
          <TelemetryStream className="h-[260px] lg:h-auto lg:flex-[2]" />
        </aside>

        {/* Right pane — leaderboard & posture */}
        <section className="flex flex-col gap-4 min-w-0">
          <motion.div
            key={profile}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
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
            {compareList.length > 0 && (
              <span className="ml-auto text-xs">
                {compareList.length}/2 selected for VS
                {compareList.length === 2 && <span className="text-primary ml-1">— comparison ready ↓</span>}
              </span>
            )}
          </motion.div>

          <div role="tablist" aria-label="Catalog filter" className="flex gap-1 overflow-x-auto border-b border-border">
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

          <LeaderboardTable tools={visible} onCompare={handleCompare} compareSelected={compareList} driver={driver} />

          <AnimatePresence>
            {compareTools && <ComparisonEngine tools={compareTools} onClose={() => setCompareList([])} />}
          </AnimatePresence>
        </section>
      </main>

      <footer className="border-t border-border mt-8">
        <div className="max-w-[1600px] mx-auto px-4 py-5 text-center text-[11px] text-muted-foreground">
          Vigilance AI — Tool posture from public vendor policies; vulnerabilities live from NVD &amp; OSV.dev. Telemetry and policy-watch events are simulated.
        </div>
      </footer>
    </div>
  );
};

export default Index;
