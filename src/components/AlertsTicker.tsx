import { alerts } from '@/data/tools';

export function AlertsTicker() {
  const doubled = [...alerts, ...alerts];
  return (
    <div className="w-full overflow-hidden glass-card py-2 px-4">
      <div className="flex ticker-scroll whitespace-nowrap gap-12">
        {doubled.map((alert, i) => (
          <span key={`${alert.id}-${i}`} className="inline-flex items-center gap-2 text-sm">
            <span className="text-muted-foreground font-mono text-xs">{alert.time}</span>
            <span className="text-foreground">{alert.message}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
