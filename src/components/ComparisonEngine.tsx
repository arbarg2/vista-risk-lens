import { motion } from 'framer-motion';
import type { AITool } from '@/data/tools';
import { usePosture } from '@/context/PostureContext';
import { PROFILE_THRESHOLD } from '@/lib/posture';
import { ToolRadarChart } from './ToolRadarChart';
import { ScoreRing } from './ScoreRing';
import { X } from 'lucide-react';

function GapBar({ label, a, b }: { label: string; a: number; b: number }) {
  const diff = a - b;
  const color = diff > 0 ? 'text-safe' : diff < 0 ? 'text-danger' : 'text-muted-foreground';
  return (
    <div className="grid grid-cols-[6rem_2rem_1fr_2.5rem_1fr_2rem] items-center gap-2 text-xs">
      <span className="text-muted-foreground text-right">{label}</span>
      <span className="text-right font-mono text-foreground">{a}</span>
      <div className="h-1.5 bg-secondary rounded-full relative overflow-hidden">
        <motion.div className="absolute right-0 top-0 h-full rounded-full bg-safe" initial={{ width: 0 }} animate={{ width: `${a}%` }} transition={{ duration: 0.7 }} />
      </div>
      <span className={`font-mono text-center ${color}`}>{diff > 0 ? '+' : ''}{diff}</span>
      <div className="h-1.5 bg-secondary rounded-full relative overflow-hidden">
        <motion.div className="absolute left-0 top-0 h-full rounded-full bg-warning" initial={{ width: 0 }} animate={{ width: `${b}%` }} transition={{ duration: 0.7 }} />
      </div>
      <span className="font-mono text-foreground">{b}</span>
    </div>
  );
}

export function ComparisonEngine({ tools: [a, b], onClose }: { tools: [AITool, AITool]; onClose: () => void }) {
  const { scores, profile } = usePosture();
  const sa = scores[a.id];
  const sb = scores[b.id];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="glass-card-elevated p-5"
      aria-label="Risk gap analysis"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-foreground">Risk Gap Analysis</h3>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary transition-colors" aria-label="Close comparison">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-2xl">{a.logo}</span>
              <span className="font-semibold text-sm text-safe">{a.name}</span>
              <ScoreRing score={sa.total} size={64} strokeWidth={4} />
            </div>
            <span className="text-2xl font-black text-muted-foreground">VS</span>
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-2xl">{b.logo}</span>
              <span className="font-semibold text-sm text-warning">{b.name}</span>
              <ScoreRing score={sb.total} size={64} strokeWidth={4} />
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <GapBar label="Performance" a={sa.perfScore} b={sb.perfScore} />
            <GapBar label="Trust (live)" a={sa.trustScore} b={sb.trustScore} />
            <GapBar label="Sovereignty" a={sa.sovScore} b={sb.sovScore} />
            <GapBar label="Privacy" a={sa.privScore} b={sb.privScore} />
            <GapBar label="Security" a={sa.secScore} b={sb.secScore} />
            <GapBar label="OWASP" a={sa.owaspScore} b={sb.owaspScore} />
          </div>
        </div>
        <div className="flex justify-center">
          <ToolRadarChart score={sa} compareScore={sb} threshold={PROFILE_THRESHOLD[profile]} size={240} />
        </div>
      </div>
    </motion.section>
  );
}
