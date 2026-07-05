import React from 'react';

interface Candidate {
  id: string;
  nom: string;
  prenom: string;
}

interface Vote {
  candidat_id: string | null;
  created_at: string;
}

interface VoteEvolutionChartProps {
  candidates: Candidate[];
  votes: Vote[];
  dateOuverture: string | null;
  dateFermeture: string | null;
}

const LINE_COLORS = [
  '#f59e0b', // Gold
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f97316'  // Orange
];

export default function VoteEvolutionChart({
  candidates,
  votes,
  dateOuverture,
  dateFermeture
}: VoteEvolutionChartProps) {
  // Tri chronologique des votes
  const sortedVotes = [...votes].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const now = new Date();
  const startTime = dateOuverture
    ? new Date(dateOuverture).getTime()
    : sortedVotes[0]
    ? new Date(sortedVotes[0].created_at).getTime()
    : now.getTime() - 3600000;
  const endTime = dateFermeture
    ? new Date(dateFermeture).getTime()
    : sortedVotes[sortedVotes.length - 1]
    ? new Date(sortedVotes[sortedVotes.length - 1].created_at).getTime()
    : now.getTime();

  const duration = Math.max(endTime - startTime, 60000); // minimum 1 min
  const numPoints = 8; // Nombre d'intervalles sur l'axe X
  const interval = duration / numPoints;

  // Calcul des données cumulées pour chaque point d'intervalle
  const chartData: Array<{
    timeLabel: string;
    timestamp: number;
    totals: Record<string, number>;
  }> = [];

  let maxVoteValue = 1; // Valeur max pour dimensionner l'axe Y

  for (let i = 0; i <= numPoints; i++) {
    const targetTime = startTime + i * interval;

    // Compter les votes accumulés avant targetTime
    const totals: Record<string, number> = {};
    candidates.forEach((c) => {
      totals[c.id] = 0;
    });

    sortedVotes.forEach((v) => {
      if (
        v.created_at &&
        new Date(v.created_at).getTime() <= targetTime &&
        v.candidat_id &&
        totals[v.candidat_id] !== undefined
      ) {
        totals[v.candidat_id]++;
      }
    });

    // Chercher le max pour l'échelle Y
    candidates.forEach((c) => {
      if (totals[c.id] > maxVoteValue) {
        maxVoteValue = totals[c.id];
      }
    });

    // Label lisible (HH:MM)
    const timeLabel = new Date(targetTime).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    chartData.push({
      timeLabel,
      timestamp: targetTime,
      totals
    });
  }

  // Dimensions du graphique SVG
  const width = 600;
  const height = 240;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 45;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Arrondir le max de l'axe Y au nombre entier supérieur pour faire propre
  const yAxisMax = Math.ceil(maxVoteValue * 1.1);

  // Générer les coordonnées des points pour chaque candidat
  const candidatePaths = candidates.map((cand, candIdx) => {
    const points = chartData.map((data, idx) => {
      const x = paddingLeft + (idx / numPoints) * chartWidth;
      const val = data.totals[cand.id] || 0;
      const y = height - paddingBottom - (val / yAxisMax) * chartHeight;
      return { x, y, val, time: data.timeLabel };
    });

    // Construire le tracé SVG (path line)
    const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return {
      candidate: cand,
      color: LINE_COLORS[candIdx % LINE_COLORS.length],
      points,
      pathD
    };
  });

  // Graduations Y (4 lignes de grille)
  const yTicks: Array<{ val: number; y: number }> = [];
  const numYTicks = 4;
  for (let i = 0; i <= numYTicks; i++) {
    const val = Math.round((i / numYTicks) * yAxisMax);
    const y = height - paddingBottom - (val / yAxisMax) * chartHeight;
    yTicks.push({ val, y });
  }

  return (
    <div className="w-full space-y-4">
      {/* Légende au-dessus */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-xs font-semibold print:text-black">
        {candidates.map((cand, idx) => {
          const color = LINE_COLORS[idx % LINE_COLORS.length];
          return (
            <div key={cand.id} className="flex items-center gap-1.5">
              <span
                className="w-3 h-0.5 inline-block"
                style={{ backgroundColor: color, borderTop: `2px solid ${color}` }}
              />
              <span className="text-gray-300 print:text-black">
                {cand.prenom} {cand.nom}
              </span>
            </div>
          );
        })}
      </div>

      {/* SVG du Graphique */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="100%"
          className="overflow-visible font-mono"
        >
          {/* Lignes de Grille Horizontales et graduation Y */}
          {yTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={width - paddingRight}
                y2={tick.y}
                className="stroke-white/5 print:stroke-black/5"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="text-[9px] fill-gray-400 print:fill-black font-medium"
              >
                {tick.val}
              </text>
            </g>
          ))}

          {/* Lignes de Grille Verticales et graduation X */}
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

          {/* Tracés des Courbes d'évolution */}
          {candidatePaths.map((path) => (
            <g key={path.candidate.id}>
              {/* Ombre de la ligne pour le contraste */}
              <path
                d={path.pathD}
                fill="none"
                stroke="rgba(0,0,0,0.25)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Ligne principale */}
              <path
                d={path.pathD}
                fill="none"
                stroke={path.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-500"
              />
              {/* Points/Dots sur la courbe */}
              {path.points.map((p, pIdx) => (
                <circle
                  key={pIdx}
                  cx={p.x}
                  cy={p.y}
                  r="3.5"
                  fill={path.color}
                  stroke="rgba(0, 0, 0, 0.4)"
                  strokeWidth="1"
                  className="hover:r-5 cursor-pointer transition-all"
                />
              ))}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
