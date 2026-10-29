import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AITool } from '@/data/tools';
import { usePosture } from '@/context/PostureContext';
import { PROFILE_LABELS } from '@/lib/posture';
import { ComparisonEngine } from './ComparisonEngine';
import { Zap } from 'lucide-react';

interface CompareModalProps {
  tools: [AITool, AITool] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
}

export function CompareModal({ tools, open, onOpenChange, onClear }: CompareModalProps) {
  const { profile } = usePosture();
  return (
    <Dialog open={open && !!tools} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card-elevated w-[min(1100px,96vw)] max-w-none max-h-[94vh] overflow-y-auto p-6 sm:p-8 gap-6 border-glass-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="w-5 h-5 text-primary" />
            Risk Gap Analysis
          </DialogTitle>
          <DialogDescription>
            {tools ? `${tools[0].name} vs ${tools[1].name}` : ''} · scored for {PROFILE_LABELS[profile]}
          </DialogDescription>
        </DialogHeader>
        {tools && <ComparisonEngine tools={tools} embedded />}
        <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
          <button
            onClick={() => { onClear(); onOpenChange(false); }}
            className="px-3 py-1.5 text-xs rounded-md font-medium bg-secondary text-secondary-foreground hover:bg-secondary/70 transition-colors"
          >
            Clear selection
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-xs rounded-md font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
