'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  User,
  Calendar,
  MapPin,
  Package,
  Clock,
  Phone,
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
  delivery_status: string | false;
  website_id: [number, string] | false;
}

interface ShippingAddress {
  name: string;
  street: string | false;
  street2: string | false;
  city: string | false;
  state_id: [number, string] | false;
  zip: string | false;
  country_id: [number, string] | false;
  phone: string | false;
  mobile: string | false;
}

interface OrderLine {
  id: number;
  product_id: [number, string];
  name: string;
  product_uom_qty: number;
  price_unit: number;
  price_subtotal: number;
}

const getPaymentBadge = (state: string) => {
  const map: Record<string, { label: string; color: string }> = {
    draft: { label: 'Borrador', color: 'text-gray-600 bg-gray-100' },
    sent: { label: 'Sin Pagar', color: 'text-orange-700 bg-orange-100' },
    sale: { label: 'Pagado', color: 'text-green-700 bg-green-100' },
    done: { label: 'Cerrado', color: 'text-blue-600 bg-blue-100' },
    cancel: { label: 'Cancelado', color: 'text-red-600 bg-red-100' },
  };
  return map[state] || { label: state, color: 'text-gray-600 bg-gray-100' };
};

const getDeliveryBadge = (deliveryStatus: string | false) => {
  if (!deliveryStatus || deliveryStatus === 'no') {
    return { label: 'No Enviado', color: 'text-gray-500 bg-gray-100' };
  }
  const map: Record<string, { label: string; color: string }> = {
    partial: { label: 'Envío Parcial', color: 'text-amber-700 bg-amber-100' },
    full: { label: 'Enviado', color: 'text-green-700 bg-green-100' },
  };
  return map[deliveryStatus] || { label: deliveryStatus, color: 'text-gray-500 bg-gray-100' };
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatAddress = (addr: ShippingAddress): string[] => {
  const lines: string[] = [];
  if (addr.street) lines.push(addr.street);
  if (addr.street2) lines.push(addr.street2);

  const cityParts: string[] = [];
  if (addr.city) cityParts.push(addr.city);
  if (addr.state_id) cityParts.push(addr.state_id[1]);
  if (addr.zip) cityParts.push(`CP ${addr.zip}`);
  if (cityParts.length > 0) lines.push(cityParts.join(', '));

  if (addr.country_id) lines.push(addr.country_id[1]);
  return lines;
};

export default function OrderDetailPage() {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [shippingAddr, setShippingAddr] = useState<ShippingAddress | null>(null);
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
      setShippingAddr(data.shippingAddress || null);
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
      <div className="p-4 md:p-6">
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

  const payment = getPaymentBadge(order.state);
  const delivery = getDeliveryBadge(order.delivery_status);
  const addressLines = shippingAddr ? formatAddress(shippingAddr) : [];
  const contactPhone = shippingAddr?.mobile || shippingAddr?.phone || null;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Botón volver */}
      <button
        onClick={() => router.push('/orders')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Volver a Pedidos</span>
      </button>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl text-gray-900">{order.name}</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Detalle del pedido</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 text-xs md:text-sm font-semibold rounded-full ${payment.color}`}>
            {payment.label}
          </span>
          <span className={`px-3 py-1.5 text-xs md:text-sm font-semibold rounded-full ${delivery.color}`}>
            {delivery.label}
          </span>
        </div>
      </div>

      {/* Grid de información */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Cliente y Fecha */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-center gap-3 mb-3 md:mb-4">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            </div>
            <h3 className="text-base md:text-lg text-gray-900">Cliente</h3>
          </div>
          <p className="text-sm md:text-base text-gray-900 font-medium">{order.partner_id[1]}</p>
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-xs md:text-sm text-gray-600">Pedido:</span>
              <span className="text-xs md:text-sm text-gray-900 font-medium">
                {new Date(order.date_order).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Buenos_Aires',
                })}
              </span>
            </div>
            {order.commitment_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs md:text-sm text-gray-600">Entrega:</span>
                <span className="text-xs md:text-sm text-gray-900 font-medium">
                  {new Date(order.commitment_date).toLocaleDateString('es-ES', {
                    timeZone: 'America/Buenos_Aires',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Dirección de envío */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-center gap-3 mb-3 md:mb-4">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            </div>
            <h3 className="text-base md:text-lg text-gray-900">Dirección de Envío</h3>
          </div>
          {shippingAddr ? (
            <div className="space-y-1.5">
              <p className="text-sm md:text-base text-gray-900 font-medium">{shippingAddr.name}</p>
              {addressLines.map((line, i) => (
                <p key={i} className="text-sm text-gray-600">{line}</p>
              ))}
              {contactPhone && (
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <a
                    href={`https://wa.me/549${contactPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-700 hover:text-green-800 hover:underline"
                  >
                    {contactPhone}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Sin dirección de envío</p>
          )}
        </div>

      </div>

      {/* Productos del pedido */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-gray-600" />
            <h3 className="text-base md:text-lg text-gray-900">
              Productos a preparar
            </h3>
            <span className="text-xs md:text-sm text-gray-500">
              ({lines.length} {lines.length === 1 ? 'producto' : 'productos'})
            </span>
          </div>
        </div>

        {/* Mobile: card list */}
        <div className="md:hidden divide-y divide-gray-200">
          {lines.map((line) => (
            <div key={line.id} className="p-4">
              <p className="font-medium text-gray-900 text-sm">{line.product_id[1]}</p>
              {line.name !== line.product_id[1] && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{line.name}</p>
              )}
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-gray-600">
                  {line.product_uom_qty} x {formatCurrency(line.price_unit)}
                </div>
                <p className="font-semibold text-gray-900 text-sm">
                  {formatCurrency(line.price_subtotal)}
                </p>
              </div>
            </div>
          ))}
          <div className="p-4 bg-gray-50 flex items-center justify-between">
            <p className="font-semibold text-gray-900">Total</p>
            <p className="text-lg font-bold text-primary-700">
              {formatCurrency(order.amount_total)}
            </p>
          </div>
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
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
