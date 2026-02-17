'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  User,
  Calendar,
  MapPin,
  FileText,
  Package,
  Clock,
} from 'lucide-react';

interface OrderDetail {
  id: number;
  name: string;
  partner_id: [number, string];
  partner_shipping_id: [number, string] | false;
  date_order: string;
  commitment_date: string | false;
  amount_total: number;
  state: string;
  website_id: [number, string] | false;
  note: string | false;
}

interface OrderLine {
  id: number;
  product_id: [number, string];
  name: string;
  product_uom_qty: number;
  price_unit: number;
  price_subtotal: number;
}

const getStateBadge = (state: string) => {
  const map: Record<string, { label: string; color: string }> = {
    draft: { label: 'Borrador', color: 'text-gray-600 bg-gray-100' },
    sent: { label: 'Sin Pagar', color: 'text-orange-700 bg-orange-50' },
    sale: { label: 'Pagado', color: 'text-green-700 bg-green-50' },
    done: { label: 'Completado', color: 'text-blue-600 bg-blue-50' },
    cancel: { label: 'Cancelado', color: 'text-red-600 bg-red-50' },
  };
  return map[state] || { label: state, color: 'text-gray-600 bg-gray-100' };
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export default function OrderDetailPage() {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  useEffect(() => {
    loadOrderDetail();
  }, [orderId]);

  const loadOrderDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/orders/${orderId}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Pedido no encontrado');
        } else {
          throw new Error('Error al cargar pedido');
        }
        return;
      }

      const data = await response.json();
      setOrder(data.order);
      setLines(data.lines);
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar el detalle del pedido');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.push('/orders')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver a Pedidos</span>
        </button>
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">{error || 'Pedido no encontrado'}</p>
        </div>
      </div>
    );
  }

  const badge = getStateBadge(order.state);
  const shippingAddress = order.partner_shipping_id
    ? order.partner_shipping_id[1]
    : order.partner_id[1];

  return (
    <div className="p-6 space-y-6">
      {/* Botón volver */}
      <button
        onClick={() => router.push('/orders')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Volver a Pedidos</span>
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-gray-900">{order.name}</h1>
          <p className="text-gray-600 mt-1">Detalle del pedido</p>
        </div>
        <span
          className={`px-4 py-2 text-sm font-semibold rounded-full ${badge.color}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Grid de información */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cliente */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg text-gray-900">Cliente</h3>
          </div>
          <p className="text-gray-700 font-medium">{order.partner_id[1]}</p>
        </div>

        {/* Fechas */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg text-gray-900">Fechas</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">Fecha del pedido:</span>
              <span className="text-sm text-gray-900 font-medium">
                {new Date(order.date_order).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {order.commitment_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Fecha de entrega:</span>
                <span className="text-sm text-gray-900 font-medium">
                  {new Date(order.commitment_date).toLocaleDateString('es-ES')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Dirección de envío */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg text-gray-900">Dirección de Envío</h3>
          </div>
          <p className="text-gray-700">{shippingAddress}</p>
        </div>

        {/* Notas */}
        {order.note && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-lg text-gray-900">Notas del Cliente</h3>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap">{order.note}</p>
          </div>
        )}
      </div>

      {/* Productos del pedido */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg text-gray-900">
              Productos a preparar
            </h3>
            <span className="text-sm text-gray-500">
              ({lines.length} {lines.length === 1 ? 'producto' : 'productos'})
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">
                  Producto
                </th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">
                  Descripción
                </th>
                <th className="text-right px-6 py-3 text-sm font-semibold text-gray-900">
                  Cantidad
                </th>
                <th className="text-right px-6 py-3 text-sm font-semibold text-gray-900">
                  Precio Unit.
                </th>
                <th className="text-right px-6 py-3 text-sm font-semibold text-gray-900">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lines.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">
                      {line.product_id[1]}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                    {line.name !== line.product_id[1] ? line.name : '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {line.product_uom_qty}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-700">
                    {formatCurrency(line.price_unit)}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {formatCurrency(line.price_subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td colSpan={4} className="px-6 py-4 text-right text-lg font-semibold text-gray-900">
                  Total
                </td>
                <td className="px-6 py-4 text-right text-lg font-bold text-primary-700">
                  {formatCurrency(order.amount_total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
