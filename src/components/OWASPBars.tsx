import { AITool } from '@/data/tools';
import { motion } from 'framer-motion';

interface Props { tool: AITool }

export function OWASPBars({ tool }: Props) {
  const o = tool.owasp;
  const rows = [
    { label: 'Prompt Injection Resistance', value: o.promptInjectionResistance, higherBetter: true },
    { label: 'Overreliance Risk', value: o.overrelianceRisk, higherBetter: false },
    { label: 'Model Provenance', value: o.modelProvenance, higherBetter: true },
    { label: 'Insecure Output Handling', value: o.insecureOutputHandling, higherBetter: true },
    { label: 'Supply Chain Risk', value: o.supplyChainRisk, higherBetter: false },
  ];

  return (
    <div className="flex flex-col gap-2 flex-1 min-w-[240px]">
      <h4 className="text-sm font-semibold text-foreground">OWASP Top 10 for LLMs</h4>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => {
          // Normalize so "good" is always green
          const good = r.higherBetter ? r.value : 100 - r.value;
          const color = good >= 75 ? 'bg-safe' : good >= 50 ? 'bg-warning' : 'bg-danger';
          return (
            <div key={r.label} className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs">
              <div>
                <div className="flex justify-between mb-1 font-mono">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="text-foreground">{r.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className={`h-full ${color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${r.value}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
