import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FlashCellProps {
  value: number;
  className?: string;
  /** Show a small ▲/▼ delta when the value changes. */
  showDelta?: boolean;
}

/** Numeric cell that flashes and shows the delta whenever its value changes (e.g. on profile switch). */
export function FlashCell({ value, className, showDelta = true }: FlashCellProps) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<{ key: number; delta: number } | null>(null);

  useEffect(() => {
    if (prev.current !== value) {
      const delta = value - prev.current;
      prev.current = value;
      setFlash({ key: Date.now(), delta });
      const t = setTimeout(() => setFlash(null), 1400);
      return () => clearTimeout(t);
    }
  }, [value]);

  const up = (flash?.delta ?? 0) > 0;

  return (
    <div className="relative flex items-center justify-center">
      <AnimatePresence>
        {flash && (
          <motion.span
            key={flash.key}
            initial={{ opacity: 0.9, scale: 0.8 }}
            animate={{ opacity: 0, scale: 1.25 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className={cn('absolute inset-x-0 -inset-y-1 rounded-md', up ? 'bg-safe/25' : 'bg-danger/25')}
          />
        )}
      </AnimatePresence>
      <motion.span
        key={value}
        initial={{ y: flash ? (up ? 6 : -6) : 0, opacity: flash ? 0.4 : 1 }}
        animate={{ y: 0, opacity: 1 }}
        className={cn('relative font-mono text-sm tabular-nums', className)}
      >
        {value}
      </motion.span>
      <AnimatePresence>
        {flash && showDelta && (
          <motion.span
            key={`d-${flash.key}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: -10 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={cn('absolute -top-1 right-0 text-[9px] font-mono font-semibold', up ? 'text-safe' : 'text-danger')}
          >
            {up ? '▲' : '▼'}{Math.abs(flash.delta)}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
