import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download, ExternalLink, FileJson, Server, Clock3, Scale, Unlock, Cpu, Eye, AlertTriangle, MapPin, Database,
  KeyRound, ShieldCheck, Lock, Stethoscope, FileText, Radar as RadarIcon, Activity, CalendarClock, BadgeCheck,
} from 'lucide-react';
import type { AITool } from '@/data/tools';
import { getEnrichment } from '@/data/enrichment';
import { PROFILE_LABELS, PROFILE_THRESHOLD, UNBOUNDED_RETENTION_DAYS, costToRisk, type ToolScore } from '@/lib/posture';
import { exportAIBOM } from '@/lib/aibomExport';
import { usePosture } from '@/context/PostureContext';
import type { SourceState } from '@/lib/threatFeed';
import { ToolRadarChart } from './ToolRadarChart';
import { ConfidenceBadge, FIT_META, OUTCOME_META, PolicyFitBadge } from './CredibilityBadges';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
  return now;
}

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function Bar({ label, value, threshold, weight }: { label: string; value: number; threshold: number; weight?: number }) {
  const tone = value >= threshold ? 'bg-safe' : value >= threshold - 15 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">
          {label}
          {weight !== undefined && <span className="ml-1.5 font-mono text-[10px] text-muted-foreground/70">w{weight}%</span>}
        </span>
        <span className="font-mono text-foreground">{value}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
        <motion.div className={cn('h-full rounded-full', tone)} initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.7 }} />
        <div className="absolute top-0 bottom-0 w-px bg-danger" style={{ left: `${threshold}%` }} />
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, tone }: { icon: typeof Cpu; label: string; value: React.ReactNode; tone?: 'bad' | 'good' }) {
  return (
    <div className="flex items-center gap-2 text-xs min-w-0 py-1 border-b border-border/30 last:border-b-0">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn('ml-auto text-right truncate', tone === 'bad' ? 'text-warning' : tone === 'good' ? 'text-safe' : 'text-foreground')}>{value}</span>
    </div>
  );
}

const SOURCE_LABEL: Record<SourceState, { text: string; cls: string }> = {
  live: { text: 'Active', cls: 'text-safe' },
  cached: { text: 'Cached', cls: 'text-primary' },
  loading: { text: 'Syncing', cls: 'text-warning' },
  error: { text: 'Unreachable', cls: 'text-danger' },
  idle: { text: 'Idle', cls: 'text-muted-foreground' },
};

const TAB_CLS = 'h-7 px-2.5 text-[11px] data-[state=active]:bg-background/80 data-[state=active]:text-foreground';

export function ExpandedToolPanel({ tool, score, onCompare, inCompare }: { tool: AITool; score: ToolScore; onCompare: () => void; inCompare: boolean }) {
  const { profile, statuses, threatsByTool, weights, confidence, policy, sources, lastSync, feed } = usePosture();
  const now = useNow();
  const en = getEnrichment(tool.id);
  const threshold = PROFILE_THRESHOLD[profile];
  const threats = threatsByTool[tool.id] ?? [];
  const conf = confidence[tool.id];
  const fit = policy[tool.id];
  const wSum = weights.performance + weights.sovereignty + weights.privacy + weights.security + weights.owasp || 1;
  const pct = (w: number) => Math.round((w / wSum) * 100);

  const residencyUndisclosed = tool.trust.dataSovereignty === 'Global' && en.hosting === 'Proprietary';
  const retentionUnbounded = en.retentionDays >= UNBOUNDED_RETENTION_DAYS;
  const policyEvent = [...feed].reverse().find((l) => l.tag === 'POLICY UPDATE' && (l.text.includes(tool.name) || l.text.startsWith(tool.provider)));
  const audited = tool.verified && tool.trust.soc2;

  const doExport = (fmt: 'cyclonedx' | 'spdx') => {
    exportAIBOM(fmt, tool, { score, status: statuses[tool.id], profile, threats });
    toast.success(`AIBOM exported (${fmt === 'cyclonedx' ? 'CycloneDX 1.6' : 'SPDX 2.3'})`, { description: tool.name });
  };

  const sourceRow = (key: 'NVD' | 'OSV', name: string) => {
    const st = sources[key];
    const m = SOURCE_LABEL[st.state];
    return (
      <Row
        icon={RadarIcon}
        label={`${name} sync`}
        value={<span className={m.cls}>{m.text}{lastSync && (st.state === 'live' || st.state === 'cached') ? ` · ${ago(lastSync, now)}` : ''}<span className="text-muted-foreground"> · {st.count} advisories</span></span>}
      />
    );
  };

  return (
    <div className="px-4 sm:px-5 py-5 grid gap-5 md:grid-cols-[230px_1fr] bg-secondary/20">
      {/* Posture Matrix + actions */}
      <div className="flex flex-col items-center gap-3">
        <div className="self-stretch flex items-center justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Posture Matrix</h4>
          <ConfidenceBadge result={conf} compact />
        </div>
        <ToolRadarChart score={score} threshold={threshold} size={220} />
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground -mt-2">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-safe" /> Tool</span>
          <span className="flex items-center gap-1"><span className="w-3 border-t border-dashed border-danger" /> Min. {threshold}</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-1">
          <button
            onClick={(e) => { e.stopPropagation(); onCompare(); }}
            className={cn('px-3 py-1.5 text-xs rounded-md font-medium transition-colors', inCompare ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70')}
          >
            {inCompare ? 'Selected for VS' : 'Add to VS'}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              className="px-3 py-1.5 text-xs rounded-md font-medium bg-primary/15 text-primary hover:bg-primary/25 inline-flex items-center gap-1 outline-none"
            >
              <Download className="w-3 h-3" /> Export AIBOM
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => doExport('cyclonedx')} className="gap-2 text-xs"><FileJson className="w-3.5 h-3.5" /> CycloneDX 1.6 JSON</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => doExport('spdx')} className="gap-2 text-xs"><FileJson className="w-3.5 h-3.5" /> SPDX 2.3 JSON</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Credibility tabs */}
      <Tabs defaultValue="evidence" className="min-w-0 flex flex-col gap-3">
        <TabsList className="self-start h-auto flex-wrap justify-start gap-0.5 bg-secondary/60 p-0.5">
          <TabsTrigger value="evidence" className={TAB_CLS}><FileText className="w-3 h-3 mr-1" />Evidence</TabsTrigger>
          <TabsTrigger value="assessment" className={TAB_CLS}><Activity className="w-3 h-3 mr-1" />Assessment</TabsTrigger>
          <TabsTrigger value="verification" className={TAB_CLS}><BadgeCheck className="w-3 h-3 mr-1" />Verification &amp; Confidence</TabsTrigger>
          <TabsTrigger value="fit" className={TAB_CLS}>
            {(() => { const I = FIT_META[fit.fit].icon; return <I className={cn('w-3 h-3 mr-1', FIT_META[fit.fit].cls.split(' ').find((c) => c.startsWith('text-')))} />; })()}
            Policy Fit
          </TabsTrigger>
        </TabsList>

        {/* 1. Evidence */}
        <TabsContent value="evidence" className="mt-0">
          <p className="text-[11px] text-muted-foreground mb-2">Raw vendor claims, as documented in public policies — not adjusted by Vigilance scoring.</p>
          <div className="grid gap-x-6 sm:grid-cols-2">
            <div>
              <Row icon={MapPin} label="Hosting region" value={residencyUndisclosed ? 'Not disclosed' : `${tool.trust.dataSovereignty} · ${en.hosting}`} tone={residencyUndisclosed ? 'bad' : undefined} />
              <Row icon={Clock3} label="Retention window" value={retentionUnbounded ? 'No bounded window published' : en.retentionDays === 0 ? '0 days (zero-retention option)' : `${en.retentionDays} days`} tone={retentionUnbounded ? 'bad' : undefined} />
              <Row icon={Scale} label="IP indemnification" value={en.ipIndemnification ? 'Offered · cap set in vendor contract' : 'Not offered'} tone={en.ipIndemnification ? undefined : 'bad'} />
              <Row icon={Database} label="Trains on your data" value={tool.trust.trainingPrivacy === 'Never' ? 'Never' : tool.trust.trainingPrivacy === 'Opt-out' ? 'Yes, unless opted out' : 'Yes (opted in)'} tone={tool.trust.trainingPrivacy === 'Opt-in' ? 'bad' : undefined} />
              <Row icon={Eye} label="AI content marking" value={en.transparency ? 'Disclosed (Art. 50)' : 'Not disclosed'} tone={en.transparency ? undefined : 'bad'} />
            </div>
            <div>
              <Row icon={KeyRound} label="SSO / SAML" value={tool.trust.sso ? 'Claimed' : 'Not offered'} tone={tool.trust.sso ? undefined : 'bad'} />
              <Row icon={ShieldCheck} label="SOC 2" value={tool.trust.soc2 ? (tool.verified ? 'Report on file' : 'Claimed') : 'None'} tone={tool.trust.soc2 ? undefined : 'bad'} />
              <Row icon={Stethoscope} label="HIPAA BAA" value={tool.trust.hipaa ? 'Available' : 'Not offered'} />
              <Row icon={Lock} label="Encryption at rest" value={tool.trust.encryptionAtRest ? 'Claimed' : 'Not claimed'} tone={tool.trust.encryptionAtRest ? undefined : 'bad'} />
              <Row icon={Cpu} label="Base model" value={en.baseModel} />
              <Row icon={Unlock} label="Weights / license" value={en.openWeights ? `Open · ${en.license}` : en.license} />
            </div>
          </div>
          <a
            href={tool.policyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Source of truth: vendor policy <ExternalLink className="w-3 h-3" />
          </a>
        </TabsContent>

        {/* 2. Assessment */}
        <TabsContent value="assessment" className="mt-0">
          <p className="text-[11px] text-muted-foreground mb-2">
            How Vigilance scores this tool for <span className="text-foreground">{PROFILE_LABELS[profile]}</span>. Red line = profile minimum ({threshold}).
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2.5">
              <Bar label="Performance" value={score.perfScore} threshold={threshold} weight={pct(weights.performance)} />
              <Bar label="SOV · Data sovereignty" value={score.sovScore} threshold={threshold} weight={pct(weights.sovereignty)} />
              <Bar label="PRIV · Training privacy" value={score.privScore} threshold={threshold} weight={pct(weights.privacy)} />
              <Bar label="SEC · Security & compliance" value={score.secScore} threshold={threshold} weight={pct(weights.security)} />
              <Bar label="OWASP · LLM Top 10" value={score.owaspScore} threshold={threshold} weight={pct(weights.owasp)} />
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">OWASP detail</span>
              <Bar label="LLM01 · Prompt injection resistance" value={en.owasp.promptInjection} threshold={threshold} />
              <Bar label="LLM09 · Overreliance safeguards" value={en.owasp.overreliance} threshold={threshold} />
              <Bar label="LLM03 · Model provenance" value={en.owasp.provenance} threshold={threshold} />
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1 rounded-lg border border-border/60 bg-background/40 p-2.5">
                <span className="text-muted-foreground">Trust (before CVEs)</span><span className="font-mono text-right">{score.trustBase}</span>
                <span className="text-muted-foreground">Live CVE penalty</span><span className={cn('font-mono text-right', score.cvePenalty ? 'text-danger' : 'text-safe')}>{score.cvePenalty ? `−${score.cvePenalty}` : '0'}</span>
                <span className="text-muted-foreground">Trust (live)</span><span className="font-mono text-right">{score.trustScore}</span>
                <span className="text-muted-foreground font-semibold text-foreground">Total</span><span className="font-mono text-right font-semibold">{score.total}</span>
                <span className="text-muted-foreground">Cost-to-risk</span><span className="font-mono text-right">{costToRisk(tool, score)}</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 3. Verification & Confidence */}
        <TabsContent value="verification" className="mt-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <ConfidenceBadge result={conf} />
            <span className="text-[11px] text-muted-foreground">{conf.reasons.join(' · ')}</span>
          </div>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              {sourceRow('NVD', 'NVD CVE')}
              {sourceRow('OSV', 'OSV.dev')}
              <Row
                icon={Server}
                label="Policy watch"
                value={
                  <span>
                    {policyEvent ? <span className="text-warning">Change seen {ago(policyEvent.ts, now)}</span> : <span className="text-safe">Monitoring · no changes</span>}
                    <span className="ml-1 rounded bg-secondary px-1 font-mono text-[9px] text-muted-foreground">SIMULATED</span>
                  </span>
                }
              />
              <Row icon={BadgeCheck} label="Vendor attestation" value={audited ? 'SOC 2 audited · verified' : tool.trust.soc2 ? 'SOC 2 self-reported' : 'Self-reported only'} tone={audited ? 'good' : 'bad'} />
              <Row icon={CalendarClock} label="Evidence last reviewed" value={tool.lastUpdated} />
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-2.5 self-start">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="flex items-center gap-1 text-muted-foreground"><AlertTriangle className="w-3 h-3" /> Live CVE exposure</span>
                <span className={cn('font-mono', score.cvePenalty ? 'text-danger' : 'text-safe')}>
                  {score.cvePenalty ? `−${score.cvePenalty} trust` : 'no penalty'}
                </span>
              </div>
              {threats.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No matching advisories in its dependency stack.</p>
              ) : (
                <ul className="flex flex-col gap-1 max-h-28 overflow-y-auto pr-1">
                  {threats.slice(0, 8).map((t) => (
                    <li key={`${t.pkg}-${t.id}`} className="flex items-center gap-2 text-[11px] font-mono">
                      <span className={cn('shrink-0', t.score >= 9 ? 'text-danger' : t.score >= 7 ? 'text-warning' : 'text-muted-foreground')}>{t.score.toFixed(1)}</span>
                      <a href={t.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-foreground hover:text-primary truncate">{t.id}</a>
                      <span className="ml-auto text-muted-foreground shrink-0">{t.pkg}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </TabsContent>

        {/* 4. Policy Fit */}
        <TabsContent value="fit" className="mt-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <PolicyFitBadge fit={fit.fit} checks={fit.checks} profileLabel={PROFILE_LABELS[profile]} />
            <span className="text-[11px] text-muted-foreground">Checked against <span className="text-foreground">{PROFILE_LABELS[profile]}</span> rules. Any failed required rule makes a tool non-compliant.</span>
          </div>
          <ul className="flex flex-col divide-y divide-border/40 rounded-lg border border-border/60 bg-background/40">
            {fit.checks.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className={cn('w-[5.5rem] shrink-0 text-center rounded px-1.5 py-0.5 font-mono text-[9.5px] font-semibold', OUTCOME_META[c.outcome].cls)}>
                  {OUTCOME_META[c.outcome].label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-foreground font-medium">{c.label}</span>
                  <span className="text-muted-foreground"> — {c.detail}</span>
                </span>
                <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide', c.level === 'required' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground')}>
                  {c.level}
                </span>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
