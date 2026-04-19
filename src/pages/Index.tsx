import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { tools as allTools, ComplianceProfile, AITool, Incident, generateIncident, calcScore, getLetterGrade } from '@/data/tools';
import { ProfileToggle } from '@/components/ProfileToggle';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { ComparisonEngine } from '@/components/ComparisonEngine';
import { TerminalTicker } from '@/components/TerminalTicker';
import { IncidentSidebar } from '@/components/IncidentSidebar';
import { RemediationModal } from '@/components/RemediationModal';
import { DataSourcesPopover } from '@/components/DataSourcesPopover';
import { generateBoardReport } from '@/lib/pdfReport';
import { persistIncident, fetchRecentIncidents, subscribeIncidents } from '@/lib/incidentStore';
import { Shield, Zap, ShieldAlert, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type IncidentWithDb = Incident & { dbId?: string };

const Index = () => {
  const [profile, setProfile] = useState<ComplianceProfile>('eu-enterprise');
  const [compareList, setCompareList] = useState<string[]>([]);
  const [incidents, setIncidents] = useState<IncidentWithDb[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeIncident, setActiveIncident] = useState<IncidentWithDb | null>(null);
  const seenRef = useRef(false);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  // Hydrate from Cloud + subscribe to realtime inserts
  useEffect(() => {
    fetchRecentIncidents(50).then((rows) => {
      if (rows.length > 0) setIncidents(rows);
    });
    const unsub = subscribeIncidents((inc) => {
      setIncidents((prev) => {
        // dedupe by incident_code
        if (prev.some((p) => p.id === inc.id)) return prev;
        return [inc, ...prev].slice(0, 50);
      });
    });
    return unsub;
  }, []);

  // Background "Shadow AI" feed — generates + persists incidents
  useEffect(() => {
    const emit = async (inc: Incident) => {
      const dbId = await persistIncident(inc, profileRef.current);
      const enriched: IncidentWithDb = { ...inc, dbId: dbId ?? undefined };
      // If realtime didn't beat us to it, add locally
      setIncidents((prev) => {
        if (prev.some((p) => p.id === enriched.id)) {
          return prev.map((p) => (p.id === enriched.id ? { ...p, dbId: enriched.dbId } : p));
        }
        return [enriched, ...prev].slice(0, 50);
      });
      if (inc.severity === 'critical') {
        toast.error(`🔴 Crimson Alert · ${inc.toolName}`, {
          description: `${inc.user} ${inc.action} ${inc.toolName}`,
          action: { label: 'Review', onClick: () => { setSidebarOpen(true); setActiveIncident(enriched); } },
        });
      } else if (inc.severity === 'high') {
        toast.warning(`⚠ ${inc.toolName}`, {
          description: `${inc.user} ${inc.action} ${inc.toolName}`,
        });
      }
    };

    if (!seenRef.current) {
      seenRef.current = true;
      emit(generateIncident());
      setTimeout(() => emit(generateIncident()), 1500);
    }
    const id = setInterval(() => emit(generateIncident()), 7500 + Math.random() * 4000);
    return () => clearInterval(id);
  }, []);

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

  const orgScore = Math.round(
    [...allTools].sort((a, b) => calcScore(b, profile).total - calcScore(a, profile).total).slice(0, 10)
      .reduce((s, t) => s + calcScore(t, profile).total, 0) / 10
  );
  const grade = getLetterGrade(orgScore);
  const criticalCount = incidents.filter((i) => i.severity === 'critical').length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center glow-safe">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold gradient-text">Vigilance AI</h1>
                <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-safe bg-safe/10 border border-safe/30 px-1.5 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-safe animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">AI Security Posture Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <DataSourcesPopover />
            <div className={`hidden md:flex flex-col items-center px-3 py-1.5 rounded-lg border bg-${grade.color}/10 border-${grade.color}/30`}>
              <span className={`text-2xl font-black leading-none text-${grade.color}`}>{grade.grade}</span>
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">{orgScore}/100</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => generateBoardReport(allTools, profile)}>
              <FileDown className="w-4 h-4 mr-1" /> Board Report
            </Button>
            <Button variant="outline" size="sm" className="relative" onClick={() => setSidebarOpen(true)}>
              <ShieldAlert className="w-4 h-4 mr-1" /> Incidents
              {criticalCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger text-danger-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {criticalCount}
                </span>
              )}
            </Button>
            <ProfileToggle active={profile} onChange={setProfile} />
          </div>
        </div>
      </header>

      <div className="container max-w-7xl mx-auto px-4 mt-4">
        <TerminalTicker />
      </div>

      <main className="container max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
        <motion.div
          key={profile}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap"
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

        <LeaderboardTable
          tools={allTools}
          profile={profile}
          onCompare={handleCompare}
          compareSelected={compareList}
        />

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

      <IncidentSidebar
        incidents={incidents}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onAction={(inc) => setActiveIncident(inc)}
      />
      <RemediationModal incident={activeIncident} onClose={() => setActiveIncident(null)} />

      <footer className="border-t border-border mt-12">
        <div className="container max-w-7xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground font-mono">
          Vigilance AI · OWASP LLM Top 10 · NIST AI RMF · EU AI Act ready · Live data via NVD + Lovable Cloud + Lovable AI
        </div>
      </footer>
    </div>
  );
};

export default Index;
