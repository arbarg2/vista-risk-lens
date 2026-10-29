import { AnimatePresence, motion } from 'framer-motion';
import { Activity, PlugZap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { usePosture, type TelemetryAction } from '@/context/PostureContext';
import { cn } from '@/lib/utils';

const ACTION_CLS: Record<TelemetryAction, string> = {
  ALLOW: 'text-safe bg-safe/10',
  FLAG: 'text-warning bg-warning/10',
  BLOCK: 'text-danger bg-danger/10',
};

export function TelemetryStream({ className }: { className?: string }) {
  const { telemetry, demoTelemetry, setDemoTelemetry } = usePosture();
  const counts = telemetry.reduce(
    (acc, e) => ({ ...acc, [e.action]: acc[e.action] + 1 }),
    { ALLOW: 0, FLAG: 0, BLOCK: 0 } as Record<TelemetryAction, number>,
  );

  return (
    <section className={cn('glass-card flex flex-col min-h-0 overflow-hidden', className)} aria-label="Telemetry stream">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/70">
        <Activity className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">Shadow AI Telemetry</span>
        {demoTelemetry && <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/15 text-warning">Demo data</span>}
        {demoTelemetry && (
          <div className="hidden sm:flex gap-2 font-mono text-[10px]">
            <span className="text-safe">{counts.ALLOW} allow</span>
            <span className="text-warning">{counts.FLAG} flag</span>
            <span className="text-danger">{counts.BLOCK} block</span>
          </div>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
          Demo
          <Switch checked={demoTelemetry} onCheckedChange={setDemoTelemetry} aria-label="Show demo Shadow AI stream" className="scale-75" />
        </label>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-1.5">
        {!demoTelemetry && (
          <div className="flex flex-col items-center justify-center text-center gap-2 py-6 px-4">
            <PlugZap className="w-5 h-5 text-muted-foreground" />
            <p className="text-xs text-foreground font-medium">No proxy log source connected</p>
            <p className="text-[11px] text-muted-foreground max-w-xs">
              Live Shadow AI detection needs your company's proxy or firewall logs (e.g. Zscaler, Cloudflare, Palo Alto). Turn on <span className="text-foreground">Demo</span> to preview with synthetic events.
            </p>
          </div>
        )}
        {demoTelemetry && telemetry.length === 0 && <p className="text-[11px] text-muted-foreground py-3 font-mono">awaiting demo events…</p>}
        <AnimatePresence initial={false}>
          {telemetry.slice(0, 30).map((e) => (
            <motion.div
              key={e.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 py-1 font-mono text-[11px] border-b border-border/30 last:border-0"
            >
              <span className="text-muted-foreground/70 shrink-0">{new Date(e.ts).toTimeString().slice(0, 8)}</span>
              <span className={cn('shrink-0 px-1 rounded text-[9px] font-bold', ACTION_CLS[e.action])}>{e.action}</span>
              <span className="text-foreground/85 truncate">{e.user}<span className="text-muted-foreground"> ({e.dept}) → </span>{e.toolName}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
