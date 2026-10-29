import { useMemo } from 'react';
import { FileDown, FileText, Copy, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { tools } from '@/data/tools';
import { usePosture } from '@/context/PostureContext';
import { PROFILE_LABELS, readinessLabel, regulatoryReadiness, getScoreTone } from '@/lib/posture';
import { buildExecutiveSummary, downloadBoardPdf, type BoardReportInput } from '@/lib/boardReport';
import { cn } from '@/lib/utils';

const TONE_TEXT = { safe: 'text-safe', warning: 'text-warning', danger: 'text-danger' } as const;
const TONE_BG = { safe: 'bg-safe', warning: 'bg-warning', danger: 'bg-danger' } as const;

export function BoardReportDrawer() {
  const { statuses, scores, profile, posture, threats, incidents, isCustomWeights } = usePosture();
  const readiness = useMemo(() => regulatoryReadiness(tools, statuses, scores, profile, incidents), [statuses, scores, profile, incidents]);
  const counts = useMemo(() => ({
    approved: tools.filter((t) => statuses[t.id] === 'approved').length,
    review: tools.filter((t) => statuses[t.id] === 'review').length,
    banned: tools.filter((t) => statuses[t.id] === 'banned').length,
  }), [statuses]);

  const input: BoardReportInput = {
    tools, statuses, scores, profile, posture, readiness, threats,
    openIncidents: incidents.filter((i) => !i.resolved).length,
    totalIncidents: incidents.length,
    customWeights: isCustomWeights,
  };
  const tone = posture ? getScoreTone(posture.score >= 80 ? 80 : posture.score >= 70 ? 60 : 40) : 'warning';

  const readinessRows: [string, string, number][] = [
    ['EU AI Act', 'Art. 50 — transparency of AI-generated content & interactions', readiness.euAiActArt50],
    ['NIST AI RMF', 'Govern — every tool has a catalog decision', readiness.nist.govern],
    ['NIST AI RMF', 'Map — approved tools document model provenance', readiness.nist.map],
    ['NIST AI RMF', 'Measure — approved tools meet the profile trust threshold', readiness.nist.measure],
    ['NIST AI RMF', 'Manage — Shadow-AI incidents resolved', readiness.nist.manage],
  ];

  const summary = () => buildExecutiveSummary(input);

  return (
    <Sheet>
      <SheetTrigger className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:brightness-110 transition">
        <FileText className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Board Report</span>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg glass-card-elevated border-l border-glass-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Landmark className="w-4 h-4 text-primary" /> Executive Summary</SheetTitle>
          <SheetDescription>
            Board-ready AI risk posture for the {PROFILE_LABELS[profile]} profile{isCustomWeights ? ' (custom policy weights)' : ''}.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex items-center gap-5 rounded-xl border border-border/60 bg-background/40 p-4">
          <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center text-5xl font-black border-2', TONE_TEXT[tone], `border-current`)}>
            {posture?.grade ?? '–'}
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Approved Posture</div>
            <div className="font-mono text-2xl font-bold text-foreground">{posture ? `${posture.score}/100` : 'N/A'}</div>
            <div className="text-[11px] text-muted-foreground">Average of approved tools only · A 90+ · B 80–89 · C 70–79 · D &lt;70</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: 'Monitored', value: tools.length, cls: 'text-foreground' },
            { label: 'Approved', value: counts.approved, cls: 'text-safe' },
            { label: 'In review', value: counts.review, cls: 'text-warning' },
            { label: 'Banned', value: counts.banned, cls: 'text-danger' },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-border/60 bg-background/40 p-2.5 text-center">
              <div className={cn('font-mono text-xl font-bold', k.cls)}>{k.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</div>
            </div>
          ))}
        </div>

        <h3 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Regulatory readiness</h3>
        <div className="flex flex-col gap-3">
          {readinessRows.map(([fw, label, v]) => {
            const t = getScoreTone(v >= 80 ? 80 : v >= 50 ? 60 : 30);
            return (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-foreground"><span className="text-muted-foreground">{fw} · </span>{label}</span>
                  <span className={cn('font-mono shrink-0', TONE_TEXT[t])}>{v}% {readinessLabel(v)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-700', TONE_BG[t])} style={{ width: `${v}%` }} />
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground">Directional heuristics computed from your catalog decisions and vendor disclosures — not legal advice.</p>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => { downloadBoardPdf(input); toast.success('Board report PDF downloaded'); }}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
          >
            <FileDown className="w-4 h-4" /> Download PDF
          </button>
          <button
            onClick={async () => {
              try { await navigator.clipboard.writeText(summary()); toast.success('Executive summary copied'); }
              catch { toast.error('Clipboard unavailable'); }
            }}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-secondary px-3 py-2.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/70"
          >
            <Copy className="w-4 h-4" /> Copy executive summary
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
