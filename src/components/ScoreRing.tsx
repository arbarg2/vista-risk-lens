import { motion } from 'framer-motion';
import { getScoreColor } from '@/data/tools';

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

const colorMap = {
  safe: { stroke: 'hsl(160, 84%, 39%)', shadow: 'hsl(160, 84%, 39%)' },
  warning: { stroke: 'hsl(38, 92%, 50%)', shadow: 'hsl(38, 92%, 50%)' },
  danger: { stroke: 'hsl(0, 72%, 51%)', shadow: 'hsl(0, 72%, 51%)' },
};

export function ScoreRing({ score, size = 64, strokeWidth = 4, label }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = getScoreColor(score);
  const colors = colorMap[color];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(217, 33%, 17%)" strokeWidth={strokeWidth} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - (score / 100) * circumference }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 6px ${colors.shadow})` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-sm font-bold text-foreground">{score}</span>
        </div>
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}
