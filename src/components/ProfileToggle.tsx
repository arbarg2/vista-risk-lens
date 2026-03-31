import { motion } from 'framer-motion';
import type { ComplianceProfile } from '@/data/tools';
import { Shield, Building2, Globe, User } from 'lucide-react';

const profiles: { id: ComplianceProfile; label: string; icon: React.ElementType }[] = [
  { id: 'eu-enterprise', label: 'EU Enterprise', icon: Building2 },
  { id: 'us-fedramp', label: 'US FedRAMP', icon: Shield },
  { id: 'global-startup', label: 'Global Startup', icon: Globe },
  { id: 'personal', label: 'Personal', icon: User },
];

interface ProfileToggleProps {
  active: ComplianceProfile;
  onChange: (p: ComplianceProfile) => void;
}

export function ProfileToggle({ active, onChange }: ProfileToggleProps) {
  return (
    <div className="glass-card p-1 flex gap-1">
      {profiles.map((p) => {
        const Icon = p.icon;
        const isActive = active === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className="relative px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {isActive && (
              <motion.div
                layoutId="profile-bg"
                className="absolute inset-0 rounded-lg bg-primary/20 border border-primary/30"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
            <Icon className={`w-4 h-4 relative z-10 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={`relative z-10 hidden sm:inline ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              {p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
