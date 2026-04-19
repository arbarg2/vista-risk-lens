import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AITool, ComplianceProfile, calcScore, getScoreColor, costToRiskRatio } from '@/data/tools';
import { ScoreRing } from './ScoreRing';
import { Sparkline } from './Sparkline';
import { SafetyPerimeter } from './SafetyPerimeter';
import { OWASPBars } from './OWASPBars';
import { AIBOMPanel } from './AIBOMPanel';
import { CheckCircle2, ExternalLink, ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LeaderboardTableProps {
  tools: AITool[];
  profile: ComplianceProfile;
  onCompare: (tool: AITool) => void;
  compareSelected: string[];
}

export function LeaderboardTable({ tools, profile, onCompare, compareSelected }: LeaderboardTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, { data: any; updated_at: string }>>({});

  const handleRefreshTrust = async (e: React.MouseEvent, tool: AITool) => {
    e.stopPropagation();
    setRefreshing(tool.id);
    try {
      const { data, error } = await supabase.functions.invoke('refresh-tool-trust', {
        body: { toolId: tool.id, toolName: tool.name, provider: tool.provider, policyUrl: tool.policyUrl },
      });
      if (error || !data?.success) {
        const msg = (data as any)?.error ?? error?.message ?? 'Refresh failed';
        if (msg.includes('Rate limit')) toast.error('Rate limit hit', { description: 'Please retry in a moment.' });
        else if (msg.includes('credits')) toast.error('AI credits exhausted', { description: 'Add funds in Workspace > Usage.' });
        else toast.error('Trust refresh failed', { description: msg });
        return;
      }
      setOverrides((prev) => ({ ...prev, [tool.id]: { data: data.data, updated_at: new Date().toISOString() } }));
      toast.success(`✓ Trust signals refreshed for ${tool.name}`, {
        description: data.data.summary,
      });
    } catch (err) {
      toast.error('Trust refresh failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setRefreshing(null);
    }
  };

  const sorted = [...tools].sort((a, b) => calcScore(b, profile).total - calcScore(a, profile).total);

  return (
    <div className="glass-card-elevated overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2.5rem_1fr_5rem_5rem_5rem_5rem_5rem_3rem] gap-3 px-5 py-3 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <span>#</span>
        <span>Model</span>
        <span className="text-center">Score</span>
        <span className="text-center">Perf</span>
        <span className="text-center">Trust</span>
        <span className="text-center">Trend</span>
        <span className="text-center">$/Risk</span>
        <span></span>
      </div>

      {/* Rows */}
      {sorted.map((tool, idx) => {
        const scores = calcScore(tool, profile);
        const scoreColor = getScoreColor(scores.total);
        const isExpanded = expanded === tool.id;

        return (
          <div key={tool.id}>
            <motion.div
              layout
              className={`grid grid-cols-[2.5rem_1fr_5rem_5rem_5rem_5rem_5rem_3rem] gap-3 px-5 py-4 items-center cursor-pointer transition-colors hover:bg-secondary/40 ${
                compareSelected.includes(tool.id) ? 'bg-primary/5 border-l-2 border-l-primary' : ''
              }`}
              onClick={() => setExpanded(isExpanded ? null : tool.id)}
            >
              <span className="font-mono text-sm text-muted-foreground">{idx + 1}</span>

              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl">{tool.logo}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground truncate">{tool.name}</span>
                    {tool.verified && <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                  </div>
                  <span className="text-xs text-muted-foreground">{tool.provider}</span>
                </div>
              </div>

              <div className="flex justify-center">
                <ScoreRing score={scores.total} size={44} strokeWidth={3} />
              </div>

              <div className="text-center">
                <span className="font-mono text-sm text-foreground">{scores.perfScore}</span>
              </div>

              <div className="text-center">
                <span className={`font-mono text-sm ${scoreColor === 'safe' ? 'text-safe' : scoreColor === 'warning' ? 'text-warning' : 'text-danger'}`}>
                  {scores.trustScore}
                </span>
              </div>

              <div className="flex justify-center">
                <Sparkline data={tool.trendData} />
              </div>

              <div className="text-center">
                <span className="font-mono text-xs text-muted-foreground">${costToRiskRatio(tool, profile)}</span>
              </div>

              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </motion.div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden border-t border-border"
                >
                  <div className="px-5 py-5 grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr] gap-6 items-start bg-secondary/20">
                    <SafetyPerimeter tool={tool} profile={profile} size={260} />
                    <OWASPBars tool={tool} />
                    <div className="flex flex-col gap-3">
                      <AIBOMPanel tool={tool} />
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onCompare(tool); }}
                          className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                            compareSelected.includes(tool.id)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                          }`}
                        >
                          {compareSelected.includes(tool.id) ? 'Selected for VS' : 'Add to VS'}
                        </button>
                        <a
                          href={tool.policyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 text-xs rounded-md font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center gap-1"
                        >
                          Policy <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
