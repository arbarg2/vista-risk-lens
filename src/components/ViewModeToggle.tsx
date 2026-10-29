import { motion } from 'framer-motion';
import { BarChart3, ShieldAlert } from 'lucide-react';

export type ViewMode = 'governance' | 'secops';

const modes: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: 'governance', label: 'Governance', icon: BarChart3 },
  { id: 'secops', label: 'SecOps', icon: ShieldAlert },
];

export function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div role="tablist" aria-label="Dashboard view" className="segmented flex p-1 rounded-full">
      {modes.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.id)}
            className="relative px-3 py-1.5 rounded-full text-[13px] font-medium flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {active && (
              <motion.span layoutId="view-pill" className="absolute inset-0 rounded-full segmented-pill" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
            )}
            <Icon className={`w-3.5 h-3.5 relative z-10 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={`relative z-10 ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
