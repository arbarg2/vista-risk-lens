import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Info, Database, Cloud, Sparkles, FileCode2 } from 'lucide-react';

interface Source {
  icon: typeof Database;
  name: string;
  status: 'live' | 'static';
  desc: string;
}

const sources: Source[] = [
  { icon: Database, name: 'NVD CVE Feed', status: 'live', desc: 'National Vulnerability Database — AI/ML library CVEs (cached 1h)' },
  { icon: Cloud, name: 'Lovable Cloud', status: 'live', desc: 'Incidents + remediation audit trail (Postgres + Realtime)' },
  { icon: Sparkles, name: 'Lovable AI Gateway', status: 'live', desc: 'Gemini 2.5 Flash refreshes tool trust signals on demand' },
  { icon: FileCode2, name: 'Baseline Catalog', status: 'static', desc: '36 GenAI tools — hand-curated seed scores, AIBOM + OWASP' },
];

export function DataSourcesPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-glass-border hover:border-primary/40"
          aria-label="View data sources"
        >
          <Info className="w-3 h-3" />
          Sources
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 glass-card-elevated border-glass-border">
        <div className="mb-3">
          <h4 className="text-sm font-bold text-foreground">Data Sources</h4>
          <p className="text-xs text-muted-foreground">Where Vigilance AI gets its signals</p>
        </div>
        <div className="flex flex-col gap-2">
          {sources.map((s) => (
            <div key={s.name} className="flex items-start gap-2.5 p-2 rounded-md bg-secondary/30">
              <s.icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.status === 'live' ? 'text-safe' : 'text-muted-foreground'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{s.name}</span>
                  <span
                    className={`text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded ${
                      s.status === 'live'
                        ? 'bg-safe/10 text-safe border border-safe/30'
                        : 'bg-muted/30 text-muted-foreground border border-border'
                    }`}
                  >
                    {s.status === 'live' ? '● Live' : 'Seed'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
