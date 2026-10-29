import { Ban, MessageSquareWarning, ArrowRightLeft, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { tools } from '@/data/tools';
import { usePosture } from '@/context/PostureContext';
import { cn } from '@/lib/utils';

const SEV_CLS = {
  critical: 'border-danger/40 bg-danger/5',
  high: 'border-warning/40 bg-warning/5',
  medium: 'border-border bg-secondary/20',
};

export function IncidentsSheet() {
  const { incidents, resolveIncident, resolveAll, setStatus, bestApprovedAlternative, statuses } = usePosture();
  const open = incidents.filter((i) => !i.resolved);

  return (
    <Sheet>
      <SheetTrigger className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 transition-colors">
        <span className="relative flex w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-danger opacity-75 animate-ping" />
          <span className="relative w-2 h-2 rounded-full bg-danger" />
        </span>
        <span className="hidden lg:inline">Incidents</span>
        <span className="font-mono">{open.length}</span>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md glass-card-elevated border-l border-glass-border flex flex-col">
        <SheetHeader>
          <SheetTitle>Security Incidents</SheetTitle>
          <SheetDescription>Shadow-AI access to tools that are not on the approved catalog (simulated proxy feed).</SheetDescription>
        </SheetHeader>
        <div className="flex items-center justify-between text-xs mt-2">
          <span className="text-muted-foreground">{open.length} open · {incidents.length - open.length} resolved</span>
          <button onClick={resolveAll} disabled={!open.length} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-40">
            <CheckCheck className="w-3.5 h-3.5" /> Acknowledge all
          </button>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 -mx-2 px-2 pb-4">
          {open.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">All clear. No open incidents.</p>}
          {open.slice(0, 40).map((i) => {
            const tool = tools.find((t) => t.id === i.toolId)!;
            const alt = bestApprovedAlternative(tool);
            return (
              <div key={i.id} className={cn('rounded-lg border p-3 flex flex-col gap-2', SEV_CLS[i.severity])}>
                <div className="flex items-center gap-2 text-xs">
                  <span className={cn('font-mono text-[10px] font-bold uppercase', i.severity === 'critical' ? 'text-danger' : i.severity === 'high' ? 'text-warning' : 'text-muted-foreground')}>
                    {i.severity}
                  </span>
                  <span className="text-muted-foreground font-mono">{new Date(i.ts).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm text-foreground">
                  <span className="font-mono">{i.user}</span> <span className="text-muted-foreground">({i.dept})</span> accessed{' '}
                  <span className="font-semibold">{i.toolName}</span>
                  <span className="text-muted-foreground"> — {statuses[i.toolId] === 'banned' ? 'banned' : 'under review'}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {statuses[i.toolId] !== 'banned' && (
                    <button
                      onClick={() => { setStatus(i.toolId, 'banned'); resolveIncident(i.id, 'Tool banned'); toast.success(`${i.toolName} banned org-wide`); }}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] bg-danger/15 text-danger hover:bg-danger/25"
                    >
                      <Ban className="w-3 h-3" /> Block access
                    </button>
                  )}
                  <button
                    onClick={() => { resolveIncident(i.id, 'Justification requested'); toast(`Justification requested from ${i.user}`); }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  >
                    <MessageSquareWarning className="w-3 h-3" /> Request justification
                  </button>
                  {alt && (
                    <button
                      onClick={() => { resolveIncident(i.id, `Redirected to ${alt.name}`); toast.success(`${i.user} redirected to ${alt.name}`); }}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] bg-primary/15 text-primary hover:bg-primary/25"
                    >
                      <ArrowRightLeft className="w-3 h-3" /> Redirect → {alt.name}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
