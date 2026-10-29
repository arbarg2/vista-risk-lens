import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, ShieldQuestion, ShieldAlert } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Confidence, ConfidenceResult, PolicyCheck, PolicyFit, RuleOutcome } from '@/lib/posture';
import { cn } from '@/lib/utils';

export const CONFIDENCE_META: Record<Confidence, { label: string; short: string; cls: string; icon: typeof ShieldCheck }> = {
  high: { label: 'High', short: 'HIGH', cls: 'bg-safe/12 text-safe border-safe/30', icon: ShieldCheck },
  medium: { label: 'Medium', short: 'MED', cls: 'bg-warning/12 text-warning border-warning/30', icon: ShieldQuestion },
  low: { label: 'Low', short: 'LOW', cls: 'bg-danger/12 text-danger border-danger/30', icon: ShieldAlert },
};

export const FIT_META: Record<PolicyFit, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  compliant: { label: 'Compliant', cls: 'bg-safe/12 text-safe border-safe/30', icon: CheckCircle2 },
  conditional: { label: 'Conditional', cls: 'bg-warning/12 text-warning border-warning/30', icon: AlertTriangle },
  'non-compliant': { label: 'Non-Compliant', cls: 'bg-danger/12 text-danger border-danger/30', icon: XCircle },
};

export const OUTCOME_META: Record<RuleOutcome, { label: string; cls: string }> = {
  pass: { label: 'PASSED', cls: 'bg-safe/12 text-safe' },
  conditional: { label: 'CONDITIONAL', cls: 'bg-warning/12 text-warning' },
  fail: { label: 'FAILED', cls: 'bg-danger/12 text-danger' },
};

export function ConfidenceBadge({ result, compact = false, className }: { result: ConfidenceResult; compact?: boolean; className?: string }) {
  const m = CONFIDENCE_META[result.level];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`${m.label} confidence`}
          className={cn('inline-flex items-center gap-1 rounded border font-mono font-semibold leading-none outline-none focus-visible:ring-2 focus-visible:ring-ring', compact ? 'px-1 py-0.5 text-[8.5px]' : 'px-1.5 py-1 text-[10px]', m.cls, className)}
        >
          <m.icon className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
          {compact ? m.short : `CONFIDENCE · ${m.short === 'MED' ? 'MEDIUM' : m.short}`}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[16rem] text-xs">
        <p className="font-semibold mb-1">{m.label} confidence</p>
        <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
          {result.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

export function PolicyFitBadge({ fit, checks, profileLabel, className }: { fit: PolicyFit; checks: PolicyCheck[]; profileLabel: string; className?: string }) {
  const m = FIT_META[fit];
  const gaps = checks.filter((c) => c.outcome !== 'pass');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`Policy fit: ${m.label}`}
          className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold leading-none whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring', m.cls, className)}
        >
          <m.icon className="w-2.5 h-2.5" />
          {m.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[18rem] text-xs">
        <p className="font-semibold mb-1">{m.label} with {profileLabel}</p>
        {gaps.length === 0 ? (
          <p className="text-muted-foreground">Passes every mandatory and recommended rule.</p>
        ) : (
          <ul className="space-y-1">
            {gaps.map((c) => (
              <li key={c.id} className="flex gap-1.5">
                <span className={cn('shrink-0 rounded px-1 font-mono text-[9px] leading-4', OUTCOME_META[c.outcome].cls)}>{OUTCOME_META[c.outcome].label}</span>
                <span className="text-muted-foreground"><span className="text-foreground">{c.label}</span>{c.level === 'required' ? ' (required)' : ''} — {c.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
