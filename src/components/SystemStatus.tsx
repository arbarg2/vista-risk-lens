import { RefreshCw, Database, Radar as RadarIcon, Gauge } from 'lucide-react';
import { tools } from '@/data/tools';
import { usePosture, type SourceKey } from '@/context/PostureContext';
import type { SourceState } from '@/lib/threatFeed';
import { cn } from '@/lib/utils';

const STATE_META: Record<SourceState, { label: string; cls: string }> = {
  idle: { label: 'IDLE', cls: 'text-muted-foreground bg-secondary' },
  loading: { label: 'SYNCING', cls: 'text-warning bg-warning/10' },
  live: { label: 'LIVE', cls: 'text-safe bg-safe/10' },
  cached: { label: 'CACHED', cls: 'text-primary bg-primary/10' },
  error: { label: 'ERROR', cls: 'text-danger bg-danger/10' },
};

export function SystemStatus() {
  const { sources, lastSync, syncing, resync, threats, scores } = usePosture();
  const impacted = tools.filter((t) => scores[t.id].cvePenalty > 0).length;
  const critical = threats.filter((t) => t.score >= 9).length;

  const rows: { name: string; host: string; key: SourceKey }[] = [
    { name: 'NVD CVE API 2.0', host: 'services.nvd.nist.gov', key: 'NVD' },
    { name: 'OSV.dev', host: 'api.osv.dev', key: 'OSV' },
    { name: 'CISA KEV', host: 'cisa.gov', key: 'KEV' },
    { name: 'Vendor status', host: 'statuspage v2', key: 'STATUS' },
    { name: 'Hugging Face Hub', host: 'huggingface.co/api', key: 'HF' },
  ];

  return (
    <section className="glass-card p-3 flex flex-col gap-3" aria-label="System status">
      <div className="flex items-center gap-2">
        <Gauge className="w-3.5 h-3.5 text-primary" />
        <h2 className="text-xs font-semibold text-foreground">System Status</h2>
        <button
          onClick={resync}
          disabled={syncing}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={cn('w-3 h-3', syncing && 'animate-spin')} /> {syncing ? 'Syncing' : 'Re-sync'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Advisories', value: threats.length, icon: Database },
          { label: 'Critical', value: critical, icon: RadarIcon, tone: critical ? 'text-danger' : 'text-foreground' },
          { label: 'Tools hit', value: `${impacted}/${tools.length}`, icon: Gauge, tone: impacted ? 'text-warning' : 'text-foreground' },
        ].map((k) => (
          <div key={k.label} className="rounded-lg bg-background/40 border border-border/50 px-2 py-1.5">
            <div className="text-[10px] text-muted-foreground">{k.label}</div>
            <div className={cn('font-mono text-sm font-semibold', k.tone ?? 'text-foreground')}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map((r) => {
          const s = sources[r.key];
          const m = STATE_META[s.state];
          return (
            <div key={r.key} className="flex items-center gap-2 text-[11px]" title={s.detail}>
              <span className={cn('font-mono text-[9px] font-bold px-1.5 py-0.5 rounded', m.cls)}>{m.label}</span>
              <span className="text-foreground">{r.name}</span>
              <span className="text-muted-foreground font-mono truncate hidden sm:inline">{r.host}</span>
              <span className="ml-auto font-mono text-muted-foreground">{s.count}</span>
            </div>
          );
        })}
        <p className="text-[10px] text-muted-foreground font-mono">
          watching langchain · transformers · pytorch · torchserve · vllm · ollama
          {lastSync && <> · synced {new Date(lastSync).toLocaleTimeString()}</>}
        </p>
      </div>
    </section>
  );
}
