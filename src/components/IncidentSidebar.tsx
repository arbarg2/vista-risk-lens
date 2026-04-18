import { Incident } from '@/data/tools';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Activity, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  incidents: Incident[];
  open: boolean;
  onClose: () => void;
  onAction: (incident: Incident) => void;
}

const sevStyles: Record<Incident['severity'], string> = {
  critical: 'border-l-danger text-danger bg-danger/5',
  high: 'border-l-warning text-warning bg-warning/5',
  medium: 'border-l-primary text-primary bg-primary/5',
  low: 'border-l-muted-foreground text-muted-foreground bg-muted/20',
};

export function IncidentSidebar({ incidents, open, onClose, onAction }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 24, stiffness: 220 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-[hsl(222_47%_7%)] border-l border-glass-border z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-bold text-foreground">Security Incidents</h3>
                  <p className="text-xs text-muted-foreground font-mono">Shadow AI Interceptor · Live</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {incidents.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-muted-foreground">
                  <Activity className="w-8 h-8 opacity-50" />
                  <p className="text-sm">No incidents detected</p>
                  <p className="text-xs">Monitoring 36 GenAI surfaces…</p>
                </div>
              )}
              <AnimatePresence initial={false}>
                {incidents.map((inc) => (
                  <motion.div
                    key={inc.id}
                    layout
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    className={`border-l-4 rounded-md p-3 ${sevStyles[inc.severity]}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider">
                        {inc.severity} · {inc.department}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {new Date(inc.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">
                      <span className="font-mono text-xs text-muted-foreground">{inc.user}</span>{' '}
                      {inc.action}{' '}
                      <span className="font-semibold">{inc.toolName}</span>
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction(inc)}>
                        Take Action
                      </Button>
                      <span className="text-[10px] font-mono text-muted-foreground self-center ml-auto">
                        {inc.id}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
