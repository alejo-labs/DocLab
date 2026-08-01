import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { Tool } from '../lib/tools';
import { OnDeviceBadge } from './OnDeviceBadge';

export function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;

  const inner = (
    <article
      className={`group relative flex h-full flex-col gap-3 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-5 transition-all ${
        tool.available
          ? 'hover:-translate-y-0.5 hover:border-signal/50 hover:shadow-[0_8px_30px_-12px_rgba(20,22,27,0.25)]'
          : 'opacity-70'
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="grid size-11 place-items-center rounded-[10px] border border-line bg-paper text-ink transition-colors group-hover:border-signal/40 group-hover:text-signal-deep">
          <Icon className="size-5" aria-hidden />
        </span>
        {tool.available ? (
          <ArrowUpRight className="size-4 text-graphite transition-colors group-hover:text-signal-deep" aria-hidden />
        ) : (
          <span className="rounded-full border border-line bg-paper px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-graphite">En desarrollo</span>
        )}
      </div>

      <div className="flex-1">
        <h3 className="font-display text-base font-600 tracking-tight text-ink">{tool.name}</h3>
        <p className="mt-1 text-sm text-graphite">{tool.short}</p>
      </div>

      <OnDeviceBadge processing={tool.processing} />
    </article>
  );

  if (!tool.available) {
    return <div aria-disabled>{inner}</div>;
  }

  return (
    <Link to={`/h/${tool.slug}`} className="block">
      {inner}
    </Link>
  );
}
