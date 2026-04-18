import { Incident, tools } from '@/data/tools';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Ban, MessageSquareWarning, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  incident: Incident | null;
  onClose: () => void;
}

export function RemediationModal({ incident, onClose }: Props) {
  if (!incident) return null;

  const approvedAlt = tools
    .filter((t) => t.id !== incident.toolId && t.trust.soc2 && t.trust.encryptionAtRest && t.category)
    .sort((a, b) => (a.id === 'lovable' ? -1 : 0))[0];

  const handle = (action: string) => {
    toast.success(`✓ Remediation applied: ${action}`, {
      description: `Incident ${incident.id} — ${incident.toolName}`,
    });
    onClose();
  };

  const options = [
    {
      icon: Ban,
      title: 'Block Access',
      desc: `Add ${incident.toolName} to org-wide blocklist via SSO/proxy.`,
      color: 'text-danger border-danger/40 hover:bg-danger/10',
      onClick: () => handle('Blocked at SSO gateway'),
    },
    {
      icon: MessageSquareWarning,
      title: 'Request Justification',
      desc: `Send compliance form to ${incident.user}. Logs require sign-off.`,
      color: 'text-warning border-warning/40 hover:bg-warning/10',
      onClick: () => handle('Justification request sent'),
    },
    {
      icon: ArrowRightLeft,
      title: 'Auto-Redirect',
      desc: `Reroute ${incident.user} to approved alternative: ${approvedAlt?.name ?? 'ChatGPT Enterprise'}.`,
      color: 'text-safe border-safe/40 hover:bg-safe/10',
      onClick: () => handle(`Redirected to ${approvedAlt?.name ?? 'approved tool'}`),
    },
  ];

  return (
    <Dialog open={!!incident} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg glass-card-elevated border-glass-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
            Remediation Workflow
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs">{incident.id}</span> · {incident.user} {incident.action}{' '}
            <span className="font-semibold text-foreground">{incident.toolName}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          {options.map((o) => (
            <button
              key={o.title}
              onClick={o.onClick}
              className={`flex items-start gap-3 text-left p-3 rounded-lg border bg-secondary/30 transition-colors ${o.color}`}
            >
              <o.icon className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-foreground">{o.title}</div>
                <div className="text-xs text-muted-foreground">{o.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
