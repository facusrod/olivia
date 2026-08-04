'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export interface ExpiredCategoryDatum {
  category: string;
  qty: number;
  value: number;
}

interface ExpiredCategoryDonutProps {
  categories: ExpiredCategoryDatum[];
  formatCurrency: (value: number) => string;
}

// Paleta categórica validada (8 tonos, orden fijo — nunca ciclar ni reordenar).
const SLICE_COLORS = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
];
const OTHER_COLOR = '#898781'; // gris neutro, para el balde "Otras"
const MAX_SLICES = 7;

interface TooltipPayloadEntry {
  name: string;
  value: number;
  payload: ExpiredCategoryDatum & { color: string };
}

function DonutTooltip({
  active,
  payload,
  formatCurrency,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  formatCurrency: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="flex items-center gap-2 text-gray-900 font-semibold">
        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: entry.color }} />
        {entry.category}
      </div>
      <p className="text-gray-600 mt-1">{formatCurrency(entry.value)} · {entry.qty} u.</p>
    </div>
  );
}

function buildSlices(categories: ExpiredCategoryDatum[]) {
  const top = categories.slice(0, MAX_SLICES);
  const rest = categories.slice(MAX_SLICES);

  const slices = top.map((c, i) => ({ ...c, color: SLICE_COLORS[i] }));

  if (rest.length > 0) {
    slices.push({
      category: 'Otras',
      qty: rest.reduce((sum, c) => sum + c.qty, 0),
      value: rest.reduce((sum, c) => sum + c.value, 0),
      color: OTHER_COLOR,
    });
  }

  return slices;
}

export default function ExpiredCategoryDonut({ categories, formatCurrency }: ExpiredCategoryDonutProps) {
  if (!categories || categories.length === 0) return null;

  const slices = buildSlices(categories);

  return (
    <div>
      <div className="w-full max-w-[220px] mx-auto aspect-square">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="category"
              innerRadius="58%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((entry) => (
                <Cell key={entry.category} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip formatCurrency={formatCurrency} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 space-y-2">
        {slices.map((entry) => (
          <div key={entry.category} className="flex items-center justify-between text-xs md:text-sm">
            <span className="flex items-center gap-2 text-gray-900 font-medium truncate">
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ background: entry.color }}
              />
              {entry.category}
            </span>
            <span className="text-gray-600 flex-shrink-0 ml-2">
              {formatCurrency(entry.value)} · {entry.qty} u.
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
