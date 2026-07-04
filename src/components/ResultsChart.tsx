import React, { useState } from 'react';
import { Award } from 'lucide-react';

interface Candidate {
  id: string;
  nom: string;
  prenom: string;
  photo_url: string | null;
  slogan: string | null;
  votes_count: number;
  percentage: number;
  isWinner?: boolean;
  isTie?: boolean;
}

interface ResultsChartProps {
  candidates: Candidate[];
  totalVotes: number;
  type: 'bar' | 'doughnut';
}

// Sleek dark-mode harmonious color palette (Hex and CSS gradient equivalents)
const CHART_COLORS = [
  { stroke: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)', text: '#fbbf24', gradient: 'from-amber-500 to-yellow-400' }, // Gold/Yellow
  { stroke: '#6366f1', bg: 'rgba(99, 102, 241, 0.2)', text: '#818cf8', gradient: 'from-indigo-500 to-indigo-400' }, // Indigo
  { stroke: '#10b981', bg: 'rgba(16, 185, 129, 0.2)', text: '#34d399', gradient: 'from-emerald-500 to-emerald-400' }, // Emerald
  { stroke: '#06b6d4', bg: 'rgba(6, 182, 212, 0.2)', text: '#22d3ee', gradient: 'from-cyan-500 to-cyan-400' }, // Cyan
  { stroke: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.2)', text: '#a78bfa', gradient: 'from-violet-500 to-purple-400' }, // Violet
  { stroke: '#ec4899', bg: 'rgba(236, 72, 153, 0.2)', text: '#f472b6', gradient: 'from-pink-500 to-pink-400' }, // Pink
  { stroke: '#f97316', bg: 'rgba(249, 115, 22, 0.2)', text: '#ffedd5', gradient: 'from-orange-500 to-orange-400' } // Orange
];

export default function ResultsChart({ candidates, totalVotes, type }: ResultsChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // If no votes have been cast yet
  if (totalVotes === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500 border border-white/5 bg-white/1 rounded-2xl">
        <p className="text-sm font-semibold">Aucun suffrage exprimé</p>
        <p className="text-[11px] mt-1">Les diagrammes s'afficheront dès qu'au moins un vote sera enregistré.</p>
      </div>
    );
  }

  // --- 1. DOUGHNUT CHART CALCULATIONS ---
  // Radius R = 50. Circumference C = 2 * pi * 50 = 314.159
  const RADIUS = 50;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  
  let accumulatedPercentage = 0;

  // --- 2. BAR CHART CALCULATIONS ---
  const maxVotes = Math.max(...candidates.map(c => c.votes_count), 1);

  return (
    <div className="w-full">
      {type === 'doughnut' ? (
        // --- DOUGHNUT CHART ---
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center py-4">
          {/* SVG Doughnut */}
          <div className="md:col-span-5 flex justify-center relative">
            <svg width="220" height="220" viewBox="0 0 120 120" className="transform -rotate-90">
              {/* Background Circle */}
              <circle
                cx="60"
                cy="60"
                r={RADIUS}
                fill="transparent"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="12"
              />

              {/* Segments */}
              {candidates.map((cand, idx) => {
                const color = CHART_COLORS[idx % CHART_COLORS.length];
                const percentage = cand.percentage;
                
                // Dasharray length for this slice
                const strokeLength = (percentage / 100) * CIRCUMFERENCE;
                
                // Offset calculation (how much we skip from the start)
                const strokeOffset = CIRCUMFERENCE - (accumulatedPercentage / 100) * CIRCUMFERENCE;
                
                // Accumulate percentage for the next slice
                accumulatedPercentage += percentage;

                if (percentage === 0) return null;

                const isHovered = hoveredIndex === idx;

                return (
                  <circle
                    key={cand.id}
                    cx="60"
                    cy="60"
                    r={RADIUS}
                    fill="transparent"
                    stroke={color.stroke}
                    strokeWidth={isHovered ? "15" : "12"}
                    strokeDasharray={`${strokeLength} ${CIRCUMFERENCE}`}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="round"
                    className="transition-all duration-300 cursor-pointer origin-center"
                    style={{
                      filter: isHovered ? `drop-shadow(0 0 6px ${color.stroke}80)` : 'none'
                    }}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              })}
            </svg>

            {/* Inner Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {hoveredIndex !== null ? (
                <>
                  <span className="text-2xl font-black text-white">
                    {candidates[hoveredIndex].percentage}%
                  </span>
                  <span 
                    className="text-[10px] font-bold uppercase tracking-wider text-center max-w-[120px] truncate"
                    style={{ color: CHART_COLORS[hoveredIndex % CHART_COLORS.length].text }}
                  >
                    {candidates[hoveredIndex].prenom}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-3xl font-black text-white">{totalVotes}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Suffrages
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="md:col-span-7 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Répartition des voix</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {candidates.map((cand, idx) => {
                const color = CHART_COLORS[idx % CHART_COLORS.length];
                const isHovered = hoveredIndex === idx;

                return (
                  <div
                    key={cand.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isHovered
                        ? 'bg-white/5 border-white/10 scale-[1.02]'
                        : 'bg-white/1 border-white/5 hover:bg-white/3'
                    }`}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {/* Color dot */}
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 transition-all duration-300"
                      style={{
                        backgroundColor: color.stroke,
                        boxShadow: isHovered ? `0 0 8px ${color.stroke}` : 'none'
                      }}
                    />
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-center gap-2">
                        <p className="text-xs font-bold text-white truncate">
                          {cand.prenom} {cand.nom}
                        </p>
                        {cand.isWinner && (
                          <Award className="w-3.5 h-3.5 text-uni-gold shrink-0 fill-uni-gold/20" />
                        )}
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-gray-400 mt-0.5">
                        <span>{cand.votes_count} voix</span>
                        <span className="font-semibold" style={{ color: color.text }}>
                          {cand.percentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        // --- BAR CHART ---
        <div className="space-y-6 py-4">
          <div className="h-48 flex items-end justify-between gap-4 md:gap-8 px-4 border-b border-white/5 pb-2">
            {candidates.map((cand, idx) => {
              const color = CHART_COLORS[idx % CHART_COLORS.length];
              const barHeight = (cand.votes_count / maxVotes) * 100;
              const isHovered = hoveredIndex === idx;

              return (
                <div
                  key={cand.id}
                  className="flex-1 flex flex-col items-center h-full justify-end relative group cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Tooltip on Hover */}
                  <div 
                    className={`absolute -top-12 z-10 bg-gray-900 border border-white/10 rounded-xl px-2.5 py-1.5 shadow-xl transition-all duration-200 pointer-events-none flex flex-col items-center ${
                      isHovered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
                    }`}
                  >
                    <span className="text-[10px] text-white font-bold whitespace-nowrap">
                      {cand.prenom} {cand.nom}
                    </span>
                    <span className="text-[9px] font-semibold text-uni-gold-light mt-0.5 whitespace-nowrap">
                      {cand.votes_count} voix ({cand.percentage}%)
                    </span>
                    <div className="w-1.5 h-1.5 bg-gray-900 border-r border-b border-white/10 rotate-45 -mb-2 mt-1 shrink-0" />
                  </div>

                  {/* The bar */}
                  <div className="w-full max-w-[48px] bg-white/5 rounded-t-xl overflow-hidden h-full flex items-end relative">
                    <div
                      style={{ height: `${barHeight}%` }}
                      className={`w-full rounded-t-xl transition-all duration-500 ease-out bg-gradient-to-t ${color.gradient}`}
                    />
                    
                    {/* Shine highlight */}
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-xl" />
                  </div>

                  {/* Percentage label */}
                  <span 
                    className="text-[10px] font-bold mt-2 transition-all duration-300"
                    style={{ color: isHovered ? color.text : 'rgba(255,255,255,0.7)' }}
                  >
                    {cand.percentage}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Names and photos row */}
          <div className="flex justify-between gap-4 md:gap-8 px-4">
            {candidates.map((cand, idx) => {
              const color = CHART_COLORS[idx % CHART_COLORS.length];
              const isHovered = hoveredIndex === idx;

              return (
                <div
                  key={cand.id}
                  className="flex-1 flex flex-col items-center text-center min-w-0"
                >
                  {/* Photo or Initials */}
                  {cand.photo_url ? (
                    <img
                      src={cand.photo_url}
                      alt={`${cand.prenom} ${cand.nom}`}
                      className={`w-8 h-8 rounded-full object-cover border transition-all duration-300 ${
                        isHovered ? 'scale-110 border-white' : 'border-white/10'
                      }`}
                    />
                  ) : (
                    <div 
                      className={`w-8 h-8 rounded-full flex items-center justify-center border font-bold text-[10px] transition-all duration-300 ${
                        isHovered ? 'scale-110 border-white text-white bg-white/10' : 'border-white/5 bg-white/5 text-gray-400'
                      }`}
                    >
                      {cand.prenom[0]}{cand.nom[0]}
                    </div>
                  )}
                  
                  {/* Label */}
                  <p 
                    className={`text-[10px] font-bold mt-1.5 truncate w-full transition-all duration-300 ${
                      isHovered ? 'text-white scale-105' : 'text-gray-400'
                    }`}
                  >
                    {cand.prenom}
                  </p>
                  <p className="text-[8px] text-gray-500 font-semibold">{cand.votes_count} voix</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
