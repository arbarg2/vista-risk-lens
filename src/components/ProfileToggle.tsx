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
    <div role="tablist" aria-label="Compliance profile" className="segmented flex p-1 rounded-full">
      {profiles.map((p) => {
        const Icon = p.icon;
        const isActive = active === p.id;
        return (
          <button
            key={p.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(p.id)}
            className="relative px-3 sm:px-4 py-1.5 rounded-full text-[13px] font-medium flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isActive && (
              <motion.span
                layoutId="profile-pill"
                className="absolute inset-0 rounded-full segmented-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.8 }}
              />
            )}
            <Icon className={`w-3.5 h-3.5 relative z-10 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={`relative z-10 hidden md:inline transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
