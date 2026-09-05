'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
  ResponsiveContainer,
} from 'recharts';

export interface MonthlySalesPoint {
  month: string; // "YYYY-MM"
  pos: number;
  ecom: number;
  total: number;
  posCount?: number;
  ecomCount?: number;
  posMorning?: number;
  posAfternoon?: number;
  posMorningCount?: number;
  posAfternoonCount?: number;
}

interface MonthlySalesChartProps {
  data: MonthlySalesPoint[];
}

type ChartView = 'total' | 'shifts';

// Mapa dataKey → campo de count en el payload
const COUNT_KEY: Record<string, string> = {
  'PDV': 'posCount',
  'Ecommerce': 'ecomCount',
  'PDV Mañana': 'posMorningCount',
  'PDV Tarde': 'posAfternoonCount',
};

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const date = new Date(parseInt(year), parseInt(m) - 1, 1);
  return date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
}

function formatPeso(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  payload?: Record<string, number | string | undefined>;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((s, p) => s + (p.value || 0), 0);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p) => {
        const countKey = COUNT_KEY[p.name];
        const count = countKey && p.payload ? (p.payload[countKey] as number | undefined) : undefined;
        return (
          <div key={p.name} className="flex items-center gap-2 text-slate-600">
            <span className="inline-block w-2.5 h-2 rounded-sm" style={{ background: p.color }} />
            <span>{p.name}:</span>
            <span className="font-medium">
              {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(p.value)}
            </span>
            {typeof count === 'number' && count > 0 && (
              <span className="text-slate-400 text-xs">· {count} ops</span>
            )}
          </div>
        );
      })}
      {payload.length > 1 && (
        <div className="flex items-center gap-2 text-slate-800 font-semibold border-t border-slate-100 mt-2 pt-2">
          <span className="inline-block w-2.5 h-2" />
          <span>Total:</span>
          <span>
            {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(total)}
          </span>
        </div>
      )}
    </div>
  );
}

export default function MonthlySalesChart({ data }: MonthlySalesChartProps) {
  const hasShiftData = (data ?? []).some((d) => d.posMorning !== undefined || d.posAfternoon !== undefined);
  const [view, setView] = useState<ChartView>(hasShiftData ? 'shifts' : 'total');

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Sin datos de ventas históricas
      </div>
    );
  }

  const chartData = data.map((d) => {
    const base: Record<string, string | number | undefined> = {
      name: formatMonth(d.month),
      Ecommerce: Math.round(d.ecom),
      ecomCount: d.ecomCount,
    };
    if (view === 'shifts' && hasShiftData) {
      base['PDV Mañana'] = Math.round(d.posMorning ?? 0);
      base['PDV Tarde'] = Math.round(d.posAfternoon ?? 0);
      base.posMorningCount = d.posMorningCount;
      base.posAfternoonCount = d.posAfternoonCount;
    } else {
      base.PDV = Math.round(d.pos);
      base.posCount = d.posCount;
    }
    return base;
  });

  const brushStart = Math.max(0, chartData.length - 12);
  const showShifts = view === 'shifts' && hasShiftData;

  return (
    <div>
      {hasShiftData && (
        <div className="flex justify-end mb-3">
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setView('total')}
              className={`px-3 py-1 rounded-md transition-colors ${
                view === 'total'
                  ? 'bg-white text-slate-800 shadow-sm font-medium'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Total
            </button>
            <button
              onClick={() => setView('shifts')}
              className={`px-3 py-1 rounded-md transition-colors ${
                view === 'shifts'
                  ? 'bg-white text-slate-800 shadow-sm font-medium'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Por turno
            </button>
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatPeso}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          {(() => {
            const legendPayload = showShifts
              ? [
                  { value: 'PDV Mañana', type: 'plainline', color: '#0ea5e9', payload: { strokeDasharray: '' } },
                  { value: 'PDV Tarde', type: 'plainline', color: '#f97316', payload: { strokeDasharray: '' } },
                  { value: 'Ecommerce', type: 'plainline', color: '#6366f1', payload: { strokeDasharray: '' } },
                ]
              : [
                  { value: 'PDV', type: 'plainline', color: '#0d9488', payload: { strokeDasharray: '' } },
                  { value: 'Ecommerce', type: 'plainline', color: '#6366f1', payload: { strokeDasharray: '' } },
                ];
            const legendProps = {
              iconType: 'plainline' as const,
              iconSize: 16,
              wrapperStyle: { fontSize: '12px', paddingTop: '4px' },
              payload: legendPayload,
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return <Legend {...(legendProps as any)} />;
          })()}
          {showShifts ? (
            <>
              <Line
                type="monotone"
                dataKey="PDV Mañana"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="PDV Tarde"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </>
          ) : (
            <Line
              type="monotone"
              dataKey="PDV"
              stroke="#0d9488"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="Ecommerce"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Brush
            dataKey="name"
            startIndex={brushStart}
            height={24}
            stroke="#e2e8f0"
            fill="#f8fafc"
            travellerWidth={6}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
