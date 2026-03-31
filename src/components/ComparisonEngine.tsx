import { motion } from 'framer-motion';
import { AITool, ComplianceProfile, calcScore, getScoreColor } from '@/data/tools';
import { ToolRadarChart } from './ToolRadarChart';
import { ScoreRing } from './ScoreRing';
import { X } from 'lucide-react';

interface ComparisonEngineProps {
  tools: [AITool, AITool];
  profile: ComplianceProfile;
  onClose: () => void;
}

function GapBar({ label, a, b }: { label: string; a: number; b: number }) {
  const diff = a - b;
  const color = diff > 0 ? 'text-safe' : diff < 0 ? 'text-danger' : 'text-muted-foreground';
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground w-24 text-right">{label}</span>
      <div className="flex-1 flex items-center gap-2">
        <div className="w-12 text-right font-mono text-foreground">{a}</div>
        <div className="flex-1 h-1.5 bg-secondary rounded-full relative">
          <motion.div
            className="absolute top-0 h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${a}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
        <span className={`font-mono text-xs w-10 ${color}`}>
          {diff > 0 ? '+' : ''}{diff}
        </span>
        <div className="flex-1 h-1.5 bg-secondary rounded-full relative">
          <motion.div
            className="absolute top-0 right-0 h-full rounded-full bg-warning"
            initial={{ width: 0 }}
            animate={{ width: `${b}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
        <div className="w-12 font-mono text-foreground">{b}</div>
      </div>
    </div>
  );
}

export function ComparisonEngine({ tools: [a, b], profile, onClose }: ComparisonEngineProps) {
  const scoreA = calcScore(a, profile);
  const scoreB = calcScore(b, profile);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="glass-card-elevated p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-foreground">Risk Gap Analysis</h3>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary transition-colors">
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-8 items-center mb-8">
        <div className="flex flex-col items-center gap-3">
          <span className="text-2xl">{a.logo}</span>
          <span className="font-semibold text-foreground">{a.name}</span>
          <ScoreRing score={scoreA.total} size={80} strokeWidth={5} />
        </div>
        <span className="text-3xl font-black text-muted-foreground">VS</span>
        <div className="flex flex-col items-center gap-3">
          <span className="text-2xl">{b.logo}</span>
          <span className="font-semibold text-foreground">{b.name}</span>
          <ScoreRing score={scoreB.total} size={80} strokeWidth={5} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <GapBar label="Performance" a={scoreA.perfScore} b={scoreB.perfScore} />
        <GapBar label="Trust" a={scoreA.trustScore} b={scoreB.trustScore} />
        <GapBar label="Sovereignty" a={scoreA.sovScore} b={scoreB.sovScore} />
        <GapBar label="Privacy" a={scoreA.privScore} b={scoreB.privScore} />
        <GapBar label="Security" a={scoreA.secScore} b={scoreB.secScore} />
      </div>

      <div className="grid grid-cols-2 gap-6 mt-6">
        <div className="flex justify-center">
          <ToolRadarChart tool={a} profile={profile} size={160} />
        </div>
        <div className="flex justify-center">
          <ToolRadarChart tool={b} profile={profile} size={160} />
        </div>
      </div>
    </motion.div>
  );
}
