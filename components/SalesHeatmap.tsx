'use client';

import { Fragment } from 'react';

interface SalesHeatmapProps {
  data: number[][];
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOURS = Array.from({ length: 16 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);

function getHeatColor(value: number, max: number): string {
  if (value === 0) return 'rgb(241 245 249)'; // slate-100
  const intensity = value / max;
  const r = Math.round(16 + (1 - intensity) * 200);
  const g = Math.round(80 + (1 - intensity) * 160);
  const b = Math.round(120 + (1 - intensity) * 120);
  return `rgb(${r} ${g} ${b})`;
}

export default function SalesHeatmap({ data }: SalesHeatmapProps) {
  const max = Math.max(...data.flat());

  if (max === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <h3 className="text-base md:text-lg text-gray-900 mb-4">
        ¿Cuándo se Vende Más? <span className="text-sm font-normal text-gray-500">(último mes)</span>
      </h3>

      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
      >
        <div />
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">
            {d}
          </div>
        ))}

        {HOURS.map((hour, hi) => (
          <Fragment key={hour}>
            <div className="text-xs text-right pr-2 text-gray-500 flex items-center justify-end">
              {hour}
            </div>
            {DAYS.map((_, di) => {
              const value = data[hi]?.[di] ?? 0;
              return (
                <div
                  key={di}
                  className="aspect-[2/1] rounded-sm cursor-pointer transition-transform hover:scale-110 relative group"
                  style={{ backgroundColor: getHeatColor(value, max) }}
                >
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-bold text-white drop-shadow-md">
                      {value}
                    </span>
                  </div>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 mt-4">
        <span className="text-xs text-gray-500">Menos</span>
        {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
          <div
            key={intensity}
            className="h-3 w-6 rounded-sm"
            style={{ backgroundColor: getHeatColor(intensity * max, max) }}
          />
        ))}
        <span className="text-xs text-gray-500">Más</span>
      </div>
    </div>
  );
}
