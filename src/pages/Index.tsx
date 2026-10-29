import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { tools as allTools, ComplianceProfile, AITool } from '@/data/tools';
import { ProfileToggle } from '@/components/ProfileToggle';
import { AlertsTicker } from '@/components/AlertsTicker';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { ComparisonEngine } from '@/components/ComparisonEngine';
import { Shield, Zap } from 'lucide-react';

const Index = () => {
  const [profile, setProfile] = useState<ComplianceProfile>('eu-enterprise');
  const [compareList, setCompareList] = useState<string[]>([]);

  const handleCompare = (tool: AITool) => {
    setCompareList((prev) => {
      if (prev.includes(tool.id)) return prev.filter((id) => id !== tool.id);
      if (prev.length >= 2) return [prev[1], tool.id];
      return [...prev, tool.id];
    });
  };

  const compareTools = compareList.length === 2
    ? [allTools.find((t) => t.id === compareList[0])!, allTools.find((t) => t.id === compareList[1])!] as [AITool, AITool]
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center glow-safe">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Vigilance AI</h1>
              <p className="text-xs text-muted-foreground">Risk-Adjusted GenAI Leaderboard</p>
            </div>
          </div>
          <ProfileToggle active={profile} onChange={setProfile} />
        </div>
      </header>

      {/* Alerts Ticker */}
      <div className="container max-w-7xl mx-auto px-4 mt-4">
        <AlertsTicker />
      </div>

      {/* Main Content */}
      <main className="container max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Stats bar */}
        <motion.div
          key={profile}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Zap className="w-4 h-4 text-primary" />
          <span>
            Showing <span className="text-foreground font-semibold">{allTools.length}</span> models scored for{' '}
            <span className="text-primary font-semibold capitalize">{profile.replace('-', ' ')}</span> profile
          </span>
          {compareList.length > 0 && (
            <span className="ml-auto text-xs">
              {compareList.length}/2 selected for VS
              {compareList.length === 2 && <span className="text-primary ml-1">— Comparison ready ↓</span>}
            </span>
          )}
        </motion.div>

        {/* Leaderboard */}
        <LeaderboardTable
          tools={allTools}
          profile={profile}
          onCompare={handleCompare}
          compareSelected={compareList}
        />

        {/* Comparison Engine */}
        <AnimatePresence>
          {compareTools && (
            <ComparisonEngine
              tools={compareTools}
              profile={profile}
              onClose={() => setCompareList([])}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="container max-w-7xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          Vigilance AI — Data sourced from public policies & audit reports. Last updated March 2026.
        </div>
      </footer>
    </div>
  );
};

export default Index;
