import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { ToolScore } from '@/lib/posture';

interface ToolRadarChartProps {
  score: ToolScore;
  threshold: number;
  size?: number;
  compareScore?: ToolScore;
}

export function ToolRadarChart({ score, threshold, size = 220, compareScore }: ToolRadarChartProps) {
  const row = (s: ToolScore) => [s.perfScore, s.sovScore, s.privScore, s.secScore, s.owaspScore, s.trustScore];
  const labels = ['Perf', 'Sovereignty', 'Privacy', 'Security', 'OWASP', 'Trust'];
  const a = row(score);
  const b = compareScore ? row(compareScore) : null;
  const data = labels.map((subject, i) => ({ subject, value: a[i], threshold, compare: b ? b[i] : undefined }));

  return (
    <ResponsiveContainer width={size} height={size}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="56%">
        <PolarGrid stroke="hsl(var(--radar-grid))" strokeOpacity={1} />
        <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--foreground))', fontSize: 9.5, fontWeight: 500 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Minimum acceptable"
          dataKey="threshold"
          stroke="hsl(var(--danger))"
          strokeDasharray="4 3"
          strokeWidth={1.5}
          fill="hsl(var(--danger))"
          fillOpacity={0.06}
          isAnimationActive={false}
        />
        {b && (
          <Radar dataKey="compare" stroke="hsl(var(--warning))" fill="hsl(var(--warning))" fillOpacity={0.1} strokeWidth={2} />
        )}
        <Radar dataKey="value" stroke="hsl(var(--safe))" fill="hsl(var(--safe))" fillOpacity={0.2} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
