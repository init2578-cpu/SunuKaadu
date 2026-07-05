import React from 'react';

interface GlobalTurnoutChartProps {
  voteTimestamps: number[];
  totalEligible: number;
  dateOuverture: string | null;
  dateFermeture: string | null;
}

export default function GlobalTurnoutChart({
  voteTimestamps,
  totalEligible,
  dateOuverture,
  dateFermeture
}: GlobalTurnoutChartProps) {
  const now = new Date();
  
  // Bornes temporelles du scrutin
  const startTime = dateOuverture
    ? new Date(dateOuverture).getTime()
    : voteTimestamps[0]
    ? voteTimestamps[0]
    : now.getTime() - 3600000;
  const endTime = dateFermeture
    ? new Date(dateFermeture).getTime()
    : voteTimestamps[voteTimestamps.length - 1]
    ? voteTimestamps[voteTimestamps.length - 1]
    : now.getTime();

  const duration = Math.max(endTime - startTime, 60000);
  const numPoints = 8;
  const interval = duration / numPoints;

  // Calculer la courbe de participation cumulée
  const chartData: Array<{ timeLabel: string; count: number; percentage: number }> = [];
  const maxCapacity = Math.max(totalEligible, 1);

  for (let i = 0; i <= numPoints; i++) {
    const targetTime = startTime + i * interval;
    
    // Nombre de votants uniques ayant émargé avant targetTime
    const count = voteTimestamps.filter(t => t <= targetTime).length;
    const percentage = parseFloat(((count / maxCapacity) * 100).toFixed(1));

    const timeLabel = new Date(targetTime).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    chartData.push({
      timeLabel,
      count,
      percentage
    });
  }

  // Dimensions
  const width = 600;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 15;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Graduations Y (axe participation : 0% à 100%)
  const yTicks = [0, 25, 50, 75, 100];

  // Coordonnées des points pour le tracé
  const points = chartData.map((data, idx) => {
    const x = paddingLeft + (idx / numPoints) * chartWidth;
    const y = height - paddingBottom - (data.percentage / 100) * chartHeight;
    return { x, y, data };
  });

  // path D pour la ligne principale
  const linePathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // path D pour l'aire sous la courbe (fermer le polygone en bas)
  const areaPathD = `
    ${linePathD} 
    L ${points[points.length - 1].x} ${height - paddingBottom} 
    L ${points[0].x} ${height - paddingBottom} 
    Z
  `;

  return (
    <div className="w-full space-y-3">
      {/* Mini légende et stats */}
      <div className="flex justify-between items-center text-xs font-semibold px-2 print:text-black">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-neon-cyan/20 border border-neon-cyan inline-block print:bg-gray-200 print:border-black" />
          <span className="text-gray-300 print:text-black">Évolution globale (Taux de participation %)</span>
        </div>
        <div className="text-gray-400 print:text-black text-[10px] font-mono">
          TOTAL ÉLECTEURS : <span className="text-white print:text-black font-bold">{voteTimestamps.length} / {totalEligible}</span>
        </div>
      </div>

      {/* SVG */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="100%"
          className="overflow-visible font-mono"
        >
          {/* Grille horizontale de pourcentage */}
          {yTicks.map((pct, idx) => {
            const y = height - paddingBottom - (pct / 100) * chartHeight;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  className="stroke-white/5 print:stroke-black/5"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[9px] fill-gray-400 print:fill-black font-semibold"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Grille verticale temporelle */}
          {chartData.map((data, idx) => {
            const x = paddingLeft + (idx / numPoints) * chartWidth;
            return (
              <g key={idx}>
                {idx > 0 && idx < numPoints && (
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={height - paddingBottom}
                    className="stroke-white/5 print:stroke-black/5"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                )}
                <text
                  x={x}
                  y={height - paddingBottom + 16}
                  textAnchor="middle"
                  className="text-[9px] fill-gray-400 print:fill-black font-semibold"
                  transform={`rotate(-25, ${x}, ${height - paddingBottom + 16})`}
                >
                  {data.timeLabel}
                </text>
              </g>
            );
          })}

          {/* Axes principaux */}
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            className="stroke-white/10 print:stroke-black/10"
            strokeWidth="1.5"
          />
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={height - paddingBottom}
            className="stroke-white/10 print:stroke-black/10"
            strokeWidth="1.5"
          />

          {/* Aire sous la courbe avec dégradé transparent */}
          <defs>
            <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={areaPathD}
            fill="url(#cyanGrad)"
            className="print:fill-gray-100"
          />

          {/* Ligne principale de participation */}
          <path
            d={linePathD}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="print:stroke-black"
          />

          {/* Points sur la courbe */}
          {points.map((p, idx) => (
            <g key={idx}>
              <circle
                cx={p.x}
                cy={p.y}
                r="4"
                fill="#06b6d4"
                stroke="rgba(0, 0, 0, 0.4)"
                strokeWidth="1"
                className="print:fill-black"
              />
              {/* Bulle d'affichage de valeur sur les points clés */}
              {(idx % 2 === 0 || idx === numPoints) && (
                <text
                  x={p.x}
                  y={p.y - 8}
                  textAnchor="middle"
                  className="text-[8px] fill-white print:fill-black font-bold bg-black"
                >
                  {p.data.count}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
