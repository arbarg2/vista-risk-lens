import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Library } from 'lucide-react';
import { tools } from '@/data/tools';
import { usePosture } from '@/context/PostureContext';
import { PROFILE_LABELS } from '@/lib/posture';
import { ScoreRing } from '@/components/ScoreRing';

const card = 'glass-card rounded-xl px-4 py-3 flex items-center gap-4 min-w-0';

export function ExecutiveKPIs() {
  const { posture, statuses, policy, profile } = usePosture();
  const approved = tools.filter((t) => statuses[t.id] === 'approved').length;
  const nonCompliant = tools.filter((t) => policy[t.id]?.fit === 'non-compliant');

  // Most common failing mandatory rule across non-compliant tools
  const failCounts: Record<string, { label: string; n: number }> = {};
  for (const t of nonCompliant) {
    for (const c of policy[t.id].checks) {
      if (c.outcome === 'fail') {
        failCounts[c.id] = { label: c.label, n: (failCounts[c.id]?.n ?? 0) + 1 };
      }
    }
  }
  const top = Object.values(failCounts).sort((a, b) => b.n - a.n)[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="shrink-0 grid gap-3 grid-cols-1 sm:grid-cols-3"
    >
      <div className={card}>
        {posture ? <ScoreRing score={posture.score} size={52} strokeWidth={4} /> : <CheckCircle2 className="w-8 h-8 text-muted-foreground" />}
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Overall posture</p>
          <p className="text-xl font-bold text-foreground">
            {posture ? <>{posture.grade} <span className="text-sm font-mono text-muted-foreground">({posture.score}/100)</span></> : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">Approved tools · {PROFILE_LABELS[profile]}</p>
        </div>
      </div>

      <div className={card}>
        <Library className="w-8 h-8 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Approved catalog</p>
          <p className="text-xl font-bold text-foreground">{approved} <span className="text-sm font-normal text-muted-foreground">/ {tools.length} evaluated</span></p>
          <div className="mt-1 h-1.5 w-40 max-w-full rounded-full bg-secondary overflow-hidden">
            <motion.div className="h-full bg-safe" initial={{ width: 0 }} animate={{ width: `${(approved / tools.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className={card}>
        <AlertTriangle className={`w-8 h-8 shrink-0 ${nonCompliant.length ? 'text-danger' : 'text-safe'}`} />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Key compliance alert</p>
          <p className="text-xl font-bold text-foreground">{nonCompliant.length} <span className="text-sm font-normal text-muted-foreground">non-compliant</span></p>
          <p className="text-[11px] text-muted-foreground truncate" title={top?.label}>
            {top ? `Top failure: ${top.label} (${top.n})` : 'All tools meet mandatory rules'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
