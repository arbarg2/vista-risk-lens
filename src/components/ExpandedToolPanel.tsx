import { motion } from 'framer-motion';
import { Download, ExternalLink, FileJson, Server, Clock3, Scale, Unlock, Cpu, Eye, Swords, AlertTriangle } from 'lucide-react';
import type { AITool } from '@/data/tools';
import { getEnrichment } from '@/data/enrichment';
import { PROFILE_THRESHOLD, costToRisk, type ToolScore } from '@/lib/posture';
import { exportAIBOM } from '@/lib/aibomExport';
import { usePosture } from '@/context/PostureContext';
import { ToolRadarChart } from './ToolRadarChart';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function Bar({ label, value, threshold }: { label: string; value: number; threshold: number }) {
  const tone = value >= threshold ? 'bg-safe' : value >= threshold - 15 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{value}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
        <motion.div className={cn('h-full rounded-full', tone)} initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.7 }} />
        <div className="absolute top-0 bottom-0 w-px bg-danger" style={{ left: `${threshold}%` }} />
      </div>
    </div>
  );
}

export function ExpandedToolPanel({ tool, score, onCompare, inCompare }: { tool: AITool; score: ToolScore; onCompare: () => void; inCompare: boolean }) {
  const { profile, statuses, threatsByTool } = usePosture();
  const en = getEnrichment(tool.id);
  const threshold = PROFILE_THRESHOLD[profile];
  const threats = threatsByTool[tool.id] ?? [];

  const aibom = [
    { icon: Cpu, label: 'Base model', value: en.baseModel },
    { icon: Server, label: 'Hosting', value: en.hosting },
    { icon: Clock3, label: 'Retention', value: en.retentionDays === 0 ? 'Zero-retention option' : `${en.retentionDays} days` },
    { icon: Scale, label: 'IP indemnification', value: en.ipIndemnification ? 'Yes' : 'No', bad: !en.ipIndemnification },
    { icon: Unlock, label: 'Open weights', value: en.openWeights ? `Yes · ${en.license}` : en.license },
    { icon: Eye, label: 'AI content marking', value: en.transparency ? 'Disclosed (Art. 50)' : 'Not disclosed', bad: !en.transparency },
  ];

  const doExport = (fmt: 'cyclonedx' | 'spdx') => {
    exportAIBOM(fmt, tool, { score, status: statuses[tool.id], profile, threats });
    toast.success(`AIBOM exported (${fmt === 'cyclonedx' ? 'CycloneDX 1.6' : 'SPDX 2.3'})`, { description: tool.name });
  };

  return (
    <div className="px-4 sm:px-5 py-5 grid gap-5 md:grid-cols-[230px_1fr_1fr] bg-secondary/20">
      {/* Posture Matrix */}
      <div className="flex flex-col items-center">
        <h4 className="self-start text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Posture Matrix</h4>
        <ToolRadarChart score={score} threshold={threshold} size={230} />
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-safe" /> Tool</span>
          <span className="flex items-center gap-1"><span className="w-3 border-t border-dashed border-danger" /> Min. {threshold}</span>
        </div>
      </div>

      {/* OWASP + quick stats */}
      <div className="flex flex-col gap-3 min-w-0">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Swords className="w-3.5 h-3.5" /> OWASP LLM Top 10
        </h4>
        <Bar label="LLM01 · Prompt injection resistance" value={en.owasp.promptInjection} threshold={threshold} />
        <Bar label="LLM09 · Overreliance safeguards" value={en.owasp.overreliance} threshold={threshold} />
        <Bar label="LLM03 · Model provenance" value={en.owasp.provenance} threshold={threshold} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mt-2">
          <span className="text-muted-foreground">Data location</span><span className="text-foreground text-right">{tool.trust.dataSovereignty}</span>
          <span className="text-muted-foreground">Trains on data</span><span className="text-foreground text-right">{tool.trust.trainingPrivacy}</span>
          <span className="text-muted-foreground">SSO · SOC2 · HIPAA</span>
          <span className="text-right font-mono">
            <span className={tool.trust.sso ? 'text-safe' : 'text-danger'}>{tool.trust.sso ? '✓' : '✗'}</span>{' · '}
            <span className={tool.trust.soc2 ? 'text-safe' : 'text-danger'}>{tool.trust.soc2 ? '✓' : '✗'}</span>{' · '}
            <span className={tool.trust.hipaa ? 'text-safe' : 'text-danger'}>{tool.trust.hipaa ? '✓' : '✗'}</span>
          </span>
          <span className="text-muted-foreground">Latency</span><span className="font-mono text-foreground text-right">{tool.performance.latency}ms</span>
          <span className="text-muted-foreground">Cost / M tokens</span><span className="font-mono text-foreground text-right">{tool.costPerMToken ? `$${tool.costPerMToken}` : 'Seat'}</span>
          <span className="text-muted-foreground">Cost-to-risk</span><span className="font-mono text-foreground text-right">{costToRisk(tool, score)}</span>
        </div>
      </div>

      {/* AIBOM + CVEs + actions */}
      <div className="flex flex-col gap-3 min-w-0">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AI Bill of Materials</h4>
        <div className="grid grid-cols-1 gap-1.5">
          {aibom.map((r) => (
            <div key={r.label} className="flex items-center gap-2 text-xs min-w-0">
              <r.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground shrink-0">{r.label}</span>
              <span className={cn('ml-auto text-right truncate', r.bad ? 'text-warning' : 'text-foreground')}>{r.value}</span>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="flex items-center gap-1 text-muted-foreground"><AlertTriangle className="w-3 h-3" /> Live CVE exposure</span>
            <span className={cn('font-mono', score.cvePenalty ? 'text-danger' : 'text-safe')}>
              {score.cvePenalty ? `−${score.cvePenalty} trust` : 'no penalty'}
            </span>
          </div>
          {threats.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No matching advisories in its dependency stack.</p>
          ) : (
            <ul className="flex flex-col gap-1 max-h-24 overflow-y-auto pr-1">
              {threats.slice(0, 6).map((t) => (
                <li key={`${t.pkg}-${t.id}`} className="flex items-center gap-2 text-[11px] font-mono">
                  <span className={cn('shrink-0', t.score >= 9 ? 'text-danger' : t.score >= 7 ? 'text-warning' : 'text-muted-foreground')}>{t.score.toFixed(1)}</span>
                  <a href={t.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-foreground hover:text-primary truncate">{t.id}</a>
                  <span className="ml-auto text-muted-foreground shrink-0">{t.pkg}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-auto">
          <button
            onClick={(e) => { e.stopPropagation(); onCompare(); }}
            className={cn('px-3 py-1.5 text-xs rounded-md font-medium transition-colors', inCompare ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70')}
          >
            {inCompare ? 'Selected for VS' : 'Add to VS'}
          </button>
          <a
            href={tool.policyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="px-3 py-1.5 text-xs rounded-md font-medium bg-secondary text-secondary-foreground hover:bg-secondary/70 inline-flex items-center gap-1"
          >
            Source of truth <ExternalLink className="w-3 h-3" />
          </a>
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
    </div>
  );
}
