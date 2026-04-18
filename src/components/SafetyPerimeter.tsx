import { AITool, ComplianceProfile, calcScore, calcOwaspScore } from '@/data/tools';

interface Props {
  tool: AITool;
  profile: ComplianceProfile;
  size?: number;
}

/**
 * Safety Perimeter Visualization
 * Concentric "safe zone" circles with the tool's risk exposure rendered as
 * a polygon. Anything inside the inner ring = SAFE. Anything bleeding out
 * past the perimeter = EXPOSURE.
 */
export function SafetyPerimeter({ tool, profile, size = 280 }: Props) {
  const scores = calcScore(tool, profile);
  const owasp = calcOwaspScore(tool.owasp);

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.42;

  // 6 axes: Sovereignty, Privacy, Security, Performance, OWASP, Provenance
  const axes = [
    { label: 'Sovereignty', value: scores.sovScore },
    { label: 'Privacy', value: scores.privScore },
    { label: 'Security', value: scores.secScore },
    { label: 'Performance', value: scores.perfScore },
    { label: 'OWASP', value: owasp },
    { label: 'Provenance', value: tool.owasp.modelProvenance },
  ];

  const angle = (i: number) => (-Math.PI / 2) + (i * 2 * Math.PI) / axes.length;
  const point = (i: number, r: number) => {
    const a = angle(i);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };

  // Safety thresholds (the "safe zone")
  const safeZone = 0.75; // 75%+ is the inner safety ring
  const warnZone = 0.5;

  // Tool's actual exposure polygon (inverted so smaller = safer visually)
  const polygonPts = axes.map((a, i) => {
    const r = (a.value / 100) * maxR;
    return point(i, r).join(',');
  }).join(' ');

  // Risk exposure = area outside the safe zone
  const exposed = axes.filter((a) => a.value < 75).length;
  const exposurePct = Math.round((exposed / axes.length) * 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="overflow-visible">
        <defs>
          <radialGradient id={`safe-grad-${tool.id}`}>
            <stop offset="0%" stopColor="hsl(var(--safe))" stopOpacity="0.18" />
            <stop offset="70%" stopColor="hsl(var(--safe))" stopOpacity="0.06" />
            <stop offset="100%" stopColor="hsl(var(--safe))" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`risk-grad-${tool.id}`}>
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
          </radialGradient>
        </defs>

        {/* Danger ring (outer) */}
        <circle cx={cx} cy={cy} r={maxR} fill="hsl(var(--danger) / 0.04)" stroke="hsl(var(--danger) / 0.3)" strokeWidth={1} strokeDasharray="3 4" />
        {/* Warning ring */}
        <circle cx={cx} cy={cy} r={maxR * warnZone} fill="hsl(var(--warning) / 0.05)" stroke="hsl(var(--warning) / 0.35)" strokeWidth={1} strokeDasharray="3 4" />
        {/* Safe ring (inner) */}
        <circle cx={cx} cy={cy} r={maxR * safeZone} fill={`url(#safe-grad-${tool.id})`} stroke="hsl(var(--safe) / 0.5)" strokeWidth={1.5} />

        {/* Axis lines */}
        {axes.map((_, i) => {
          const [x, y] = point(i, maxR);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="hsl(var(--glass-border))" strokeWidth={1} />;
        })}

        {/* Exposure polygon */}
        <polygon
          points={polygonPts}
          fill={`url(#risk-grad-${tool.id})`}
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Vertex points */}
        {axes.map((a, i) => {
          const [x, y] = point(i, (a.value / 100) * maxR);
          const safe = a.value >= 75;
          return <circle key={i} cx={x} cy={y} r={3.5} fill={safe ? 'hsl(var(--safe))' : a.value >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--danger))'} />;
        })}

        {/* Axis labels */}
        {axes.map((a, i) => {
          const [x, y] = point(i, maxR + 16);
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="hsl(var(--muted-foreground))" className="font-mono uppercase tracking-wider">
              {a.label}
            </text>
          );
        })}

        {/* Center label */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="700" fill="hsl(var(--foreground))" className="font-mono">
          {scores.total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))" className="font-mono uppercase tracking-widest">
          Posture
        </text>
      </svg>

      <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-wider">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-safe" /> Safe Zone</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" /> Exposure {exposurePct}%</span>
      </div>
    </div>
  );
}
