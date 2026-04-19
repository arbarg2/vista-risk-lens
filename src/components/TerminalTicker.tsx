import { useEffect, useState } from 'react';
import { alerts } from '@/data/tools';
import { Terminal, AlertCircle, ShieldAlert } from 'lucide-react';
import { fetchLiveCVEs, type CVEEntry } from '@/lib/cveFeed';

interface Line {
  time: string;
  channel: 'POLICY' | 'CVE' | 'INTEL';
  severity: 'info' | 'warn' | 'crit';
  msg: string;
  url?: string;
}

function buildBaseFeed(): Line[] {
  const policy = alerts.map<Line>((a) => ({
    time: a.time,
    channel: 'POLICY',
    severity: a.type === 'danger' ? 'crit' : a.type === 'warning' ? 'warn' : 'info',
    msg: a.message,
  }));
  const intel: Line[] = [
    { time: 'now', channel: 'INTEL', severity: 'info', msg: 'AI-SPM scanner active — 36 models monitored' },
    { time: '1m', channel: 'INTEL', severity: 'warn', msg: 'EU AI Act Article 50 transparency deadline: 90 days' },
    { time: '4m', channel: 'INTEL', severity: 'crit', msg: 'NIST AI RMF: new guidance on agentic systems published' },
  ];
  return [...policy, ...intel];
}

function cveToLine(c: CVEEntry): Line {
  return {
    time: c.patched ? 'patched' : 'live',
    channel: 'CVE',
    severity: c.severity === 'critical' ? 'crit' : c.severity === 'high' ? 'warn' : 'info',
    msg: `${c.id} [${c.package}] CVSS ${c.cvss.toFixed(1)} — ${c.description}${c.patched ? ' [PATCHED]' : ' [PATCH REQUIRED]'}`,
    url: c.url,
  };
}

export function TerminalTicker() {
  const [feed, setFeed] = useState<Line[]>(() => buildBaseFeed());
  const [cursor, setCursor] = useState(true);
  const [liveStatus, setLiveStatus] = useState<'loading' | 'live' | 'cached' | 'offline'>('loading');

  useEffect(() => {
    const t = setInterval(() => setCursor((c) => !c), 600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, fromCache } = await fetchLiveCVEs();
        if (cancelled) return;
        if (data.length === 0) {
          setLiveStatus('offline');
          return;
        }
        const cveLines = data.map(cveToLine);
        // Interleave CVEs near the top so they're prominent
        setFeed([...cveLines, ...buildBaseFeed()]);
        setLiveStatus(fromCache ? 'cached' : 'live');
      } catch {
        setLiveStatus('offline');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Doubled for seamless scroll
  const doubled = [...feed, ...feed];

  const sevColor = (s: Line['severity']) =>
    s === 'crit' ? 'text-danger' : s === 'warn' ? 'text-warning' : 'text-safe';

  const statusLabel =
    liveStatus === 'live' ? 'LIVE · NVD' :
    liveStatus === 'cached' ? 'CACHED · NVD' :
    liveStatus === 'loading' ? 'CONNECTING' : 'OFFLINE';
  const statusColor =
    liveStatus === 'live' ? 'text-safe' :
    liveStatus === 'cached' ? 'text-primary' :
    liveStatus === 'loading' ? 'text-muted-foreground' : 'text-warning';

  return (
    <div className="rounded-xl border border-glass-border overflow-hidden bg-[hsl(222_47%_4%)] shadow-[inset_0_1px_0_hsl(var(--glass-border)/0.4)]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[hsl(222_47%_7%)] border-b border-glass-border">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <Terminal className="w-3 h-3 text-primary" />
          <span>vigilance@spm:~$</span>
          <span className="text-primary">tail -f /var/log/ai-threat-feed</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className={`flex items-center gap-1 ${statusColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusColor.replace('text-', 'bg-')} ${liveStatus === 'live' || liveStatus === 'cached' ? 'animate-pulse' : ''}`} />
            {statusLabel}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{feed.length} events</span>
        </div>
      </div>

      {/* Scroll area */}
      <div className="overflow-hidden py-2 relative">
        <div className="flex flex-col gap-0 ticker-vertical">
          {doubled.map((l, i) => {
            const Icon = l.channel === 'CVE' ? ShieldAlert : AlertCircle;
            const Wrapper: any = l.url ? 'a' : 'div';
            const wrapperProps = l.url ? { href: l.url, target: '_blank', rel: 'noopener noreferrer' } : {};
            return (
              <Wrapper
                key={i}
                {...wrapperProps}
                className={`flex items-center gap-3 px-3 py-0.5 text-[11px] font-mono whitespace-nowrap ${l.url ? 'hover:bg-secondary/40 cursor-pointer' : ''}`}
              >
                <span className="text-muted-foreground/60 w-12 shrink-0">[{l.time}]</span>
                <span className={`shrink-0 w-12 ${sevColor(l.severity)}`}>{l.channel}</span>
                <Icon className={`w-3 h-3 shrink-0 ${sevColor(l.severity)}`} />
                <span className="text-foreground/90 truncate">{l.msg}</span>
              </Wrapper>
            );
          })}
        </div>
        {/* Prompt cursor */}
        <div className="px-3 py-1 text-[11px] font-mono border-t border-glass-border/50 mt-1 bg-[hsl(222_47%_5%)]">
          <span className="text-primary">$</span>
          <span className={`ml-2 inline-block w-2 h-3.5 align-middle bg-primary ${cursor ? 'opacity-100' : 'opacity-0'}`} />
        </div>
      </div>
    </div>
  );
}
