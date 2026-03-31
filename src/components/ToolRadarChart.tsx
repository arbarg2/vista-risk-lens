import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { AITool, ComplianceProfile, calcScore } from '@/data/tools';

interface ToolRadarChartProps {
  tool: AITool;
  profile: ComplianceProfile;
  size?: number;
}

export function ToolRadarChart({ tool, profile, size = 200 }: ToolRadarChartProps) {
  const scores = calcScore(tool, profile);
  const data = [
    { subject: 'Quality', value: scores.perfScore },
    { subject: 'Privacy', value: scores.privScore },
    { subject: 'Security', value: scores.secScore },
    { subject: 'Sovereignty', value: scores.sovScore },
  ];

  return (
    <ResponsiveContainer width={size} height={size}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="hsl(217, 33%, 22%)" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 10 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          dataKey="value"
          stroke="hsl(160, 84%, 39%)"
          fill="hsl(160, 84%, 39%)"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
