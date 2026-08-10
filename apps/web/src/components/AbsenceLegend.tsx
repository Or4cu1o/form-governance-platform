// US6-5/FR-082: a legenda dos codigos de ausencia acompanha a tabela
// SEMPRE — texto visivel na tela, nunca so como title/tooltip de passagem
// do mouse (um tooltip nao aparece em nenhuma exportacao/impressao).
export interface AbsenceLegendProps {
  legend: Record<string, string>;
}

export function AbsenceLegend({ legend }: AbsenceLegendProps) {
  const entries = Object.entries(legend);
  if (entries.length === 0) return null;

  return (
    <dl aria-label="Legenda dos códigos de ausência" className="flex flex-wrap gap-x-6 gap-y-2 rounded border border-border bg-paper-sunken px-4 py-3 text-xs">
      {entries.map(([code, description]) => (
        <div key={code} className="flex items-baseline gap-1.5">
          <dt className="font-mono font-semibold text-ink">{code}</dt>
          <dd className="text-ink-muted">{description}</dd>
        </div>
      ))}
    </dl>
  );
}
