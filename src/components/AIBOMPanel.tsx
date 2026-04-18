import { AITool } from '@/data/tools';
import { Badge } from '@/components/ui/badge';
import { Cloud, Database, FileCheck, Server, GitBranch, Calendar, Lock, Globe } from 'lucide-react';

interface Props { tool: AITool }

export function AIBOMPanel({ tool }: Props) {
  const b = tool.aibom;
  const items = [
    { icon: Server, label: 'Base Model', value: b.baseModel },
    { icon: Cloud, label: 'Hosting', value: b.hostingProvider },
    { icon: Globe, label: 'Region', value: b.region },
    { icon: Database, label: 'Retention', value: b.dataRetentionDays === 0 ? 'Zero retention' : `${b.dataRetentionDays} days` },
    { icon: FileCheck, label: 'IP Indemnification', value: b.ipIndemnification ? 'Yes' : 'No', danger: !b.ipIndemnification },
    { icon: GitBranch, label: 'Open Weights', value: b.openWeights ? 'Yes' : 'No' },
    { icon: Calendar, label: 'Training Cutoff', value: b.trainingCutoff },
    ...(b.parameterCount ? [{ icon: Lock, label: 'Parameters', value: b.parameterCount }] : []),
  ];

  return (
    <div className="flex flex-col gap-3 flex-1 min-w-[260px]">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-foreground">AI Bill of Materials</h4>
        <Badge variant="outline" className="text-[10px] font-mono uppercase">AIBOM</Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs font-mono">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md bg-secondary/40 border border-border/50">
            <span className="flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider text-[10px]">
              <it.icon className="w-3 h-3" /> {it.label}
            </span>
            <span className={`text-foreground truncate ${it.danger ? 'text-danger' : ''}`}>{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
