import { ChevronDown, CheckCircle2, Clock, Ban } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ApprovalStatus } from '@/lib/posture';
import { cn } from '@/lib/utils';

export const STATUS_META: Record<ApprovalStatus, { label: string; icon: React.ElementType; chip: string; dot: string }> = {
  approved: { label: 'Approved', icon: CheckCircle2, chip: 'bg-safe/10 text-safe border-safe/25', dot: 'bg-safe' },
  review: { label: 'Under Review', icon: Clock, chip: 'bg-warning/10 text-warning border-warning/25', dot: 'bg-warning' },
  banned: { label: 'Banned', icon: Ban, chip: 'bg-danger/10 text-danger border-danger/25', dot: 'bg-danger' },
};

interface StatusSelectProps {
  value: ApprovalStatus;
  onChange: (s: ApprovalStatus) => void;
  toolName: string;
}

export function StatusSelect({ value, onChange, toolName }: StatusSelectProps) {
  const meta = STATUS_META[value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        aria-label={`Approval status for ${toolName}: ${meta.label}`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors hover:brightness-125 outline-none focus-visible:ring-2 focus-visible:ring-ring',
          meta.chip,
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
        {meta.label}
        <ChevronDown className="w-3 h-3 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()} className="glass-card-elevated border-glass-border">
        {(Object.keys(STATUS_META) as ApprovalStatus[]).map((s) => {
          const m = STATUS_META[s];
          const Icon = m.icon;
          return (
            <DropdownMenuItem key={s} onSelect={() => onChange(s)} className="gap-2 text-xs">
              <Icon className={cn('w-3.5 h-3.5', m.chip.split(' ').find((c) => c.startsWith('text-')))} />
              {m.label}
              {s === value && <span className="ml-auto text-muted-foreground">current</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
