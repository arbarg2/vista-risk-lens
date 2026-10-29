import { useEffect, useState } from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { usePosture } from '@/context/PostureContext';
import { PROFILE_LABELS, type PolicyWeights } from '@/lib/posture';
import { cn } from '@/lib/utils';

const FIELDS: { key: keyof PolicyWeights; label: string; hint: string }[] = [
  { key: 'performance', label: 'Performance', hint: 'Accuracy, latency, throughput' },
  { key: 'sovereignty', label: 'Data Sovereignty', hint: 'Where data is stored & processed' },
  { key: 'privacy', label: 'Training Privacy', hint: 'Is customer data used for training' },
  { key: 'security', label: 'Security & Compliance', hint: 'SSO/SAML, SOC2, HIPAA, encryption' },
  { key: 'owasp', label: 'OWASP LLM Top 10 Risk', hint: 'Prompt injection, overreliance, provenance' },
];

export function PolicyWeightsDrawer() {
  const { weights, setWeights, resetWeights, isCustomWeights, profile, posture } = usePosture();
  const [draft, setDraft] = useState(weights);
  useEffect(() => setDraft(weights), [weights]);

  const total = Object.values(draft).reduce((a, b) => a + b, 0) || 1;
  const pct = (v: number) => Math.round((v / total) * 100);

  const update = (key: keyof PolicyWeights, v: number) => {
    const next = { ...draft, [key]: v };
    setDraft(next);
    setWeights(next);
  };

  return (
    <Sheet>
      <SheetTrigger className="header-chip">
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">Policy</span>
        {isCustomWeights && <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-label="Custom weights active" />}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md glass-card-elevated border-l border-glass-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Enterprise Policy Weighting</SheetTitle>
          <SheetDescription>
            Tune how much each pillar counts for the <span className="text-primary">{PROFILE_LABELS[profile]}</span> profile. Scores and the Approved Posture update live.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-6">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">{f.label}</div>
                  <div className="text-[11px] text-muted-foreground">{f.hint}</div>
                </div>
                <span className="font-mono text-sm text-primary">{pct(draft[f.key])}%</span>
              </div>
              <Slider value={[draft[f.key]]} min={0} max={100} step={1} onValueChange={([v]) => update(f.key, v)} aria-label={`${f.label} weight`} />
            </div>
          ))}

          <div className="rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="text-[11px] text-muted-foreground mb-2">Effective mix (normalized to 100%)</div>
            <div className="flex h-2 rounded-full overflow-hidden">
              {FIELDS.map((f, i) => (
                <div
                  key={f.key}
                  style={{ width: `${pct(draft[f.key])}%` }}
                  className={cn(['bg-primary', 'bg-safe/70', 'bg-warning/80', 'bg-danger/70', 'bg-muted-foreground'][i])}
                  title={`${f.label} ${pct(draft[f.key])}%`}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Approved Posture with this policy</span>
              <span className="font-mono text-foreground">{posture ? `${posture.grade} · ${posture.score}/100` : '—'}</span>
            </div>
          </div>

          <button
            onClick={resetWeights}
            disabled={!isCustomWeights}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/70 disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset to {PROFILE_LABELS[profile]} defaults
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
