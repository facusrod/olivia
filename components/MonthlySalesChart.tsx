'use client';

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
}

interface MonthlySalesChartProps {
  data: MonthlySalesPoint[];
}

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
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((s, p) => s + (p.value || 0), 0);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-slate-600">
          <span className="inline-block w-2.5 h-2 rounded-sm" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-medium">
            {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(p.value)}
          </span>
        </div>
      ))}
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
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Sin datos de ventas históricas
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: formatMonth(d.month),
    POS: Math.round(d.pos),
    Ecommerce: Math.round(d.ecom),
  }));

  // Mostrar los últimos 12 meses por defecto en el brush
  const brushStart = Math.max(0, chartData.length - 12);

  return (
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
        <Legend
          iconType="plainline"
          iconSize={16}
          wrapperStyle={{ fontSize: '12px', paddingTop: '4px' }}
        />
        <Line
          type="monotone"
          dataKey="POS"
          stroke="#0d9488"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
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
  );
}
