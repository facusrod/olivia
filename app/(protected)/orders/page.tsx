'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  DollarSign,
  Calendar,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface EcommerceOrder {
  id: number;
  name: string;
  partner_id: [number, string];
  date_order: string;
  amount_total: number;
  state: string;
  delivery_status: string | false;
  website_id: [number, string] | false;
}

interface Summary {
  pendingCount: number;
  totalPendingAmount: number;
  todayCount: number;
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

type TabFilter = 'sent' | 'sale' | 'all';

export default function OrdersPage() {
  const [orders, setOrders] = useState<EcommerceOrder[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState<TabFilter>('sent');
  const router = useRouter();

  const ordersPerPage = 20;

  useEffect(() => {
    loadOrders('sent', 1);
  }, []);

  const loadOrders = async (state: TabFilter, page: number) => {
    try {
      setLoading(true);
      const offset = (page - 1) * ordersPerPage;
      const response = await fetch(
        `/api/orders?state=${state}&limit=${ordersPerPage}&offset=${offset}`
      );
      if (!response.ok) throw new Error('Error al cargar pedidos');

      const data = await response.json();
      setOrders(data.orders);
      setTotalOrders(data.total);
      setHasMore(data.hasMore);
      setSummary(data.summary);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: TabFilter) => {
    setActiveTab(tab);
    loadOrders(tab, 1);
  };

  const handlePageChange = (page: number) => {
    loadOrders(activeTab, page);
  };

  const totalPages = Math.ceil(totalOrders / ordersPerPage);

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'sent', label: 'Sin Pagar' },
    { key: 'sale', label: 'Confirmados' },
    { key: 'all', label: 'Todos' },
  ];

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl text-gray-900">Pedidos Web</h1>
        <p className="text-sm md:text-base text-gray-600 mt-1">
          Pedidos del ecommerce pendientes de preparar
        </p>
      </div>

      {/* Tarjetas resumen */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 md:gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2 md:mb-4">
              <div className="w-9 h-9 md:w-12 md:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 md:w-6 md:h-6 text-blue-600" />
              </div>
              {summary.pendingCount > 0 && (
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              )}
            </div>
            <h3 className="text-xs md:text-sm font-medium text-gray-600 mb-1">Pendientes</h3>
            <p className="text-xl md:text-3xl text-gray-900">{summary.pendingCount}</p>
            <p className="text-xs text-gray-500 mt-1 md:mt-2 hidden sm:block">Sin pagar + por preparar</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2 md:mb-4">
              <div className="w-9 h-9 md:w-12 md:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 md:w-6 md:h-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-xs md:text-sm font-medium text-gray-600 mb-1">Monto Pend.</h3>
            <p className="text-lg md:text-3xl text-gray-900">
              {formatCurrency(summary.totalPendingAmount)}
            </p>
            <p className="text-xs text-gray-500 mt-1 md:mt-2 hidden sm:block">Sin pagar + confirmados</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2 md:mb-4">
              <div className="w-9 h-9 md:w-12 md:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 md:w-6 md:h-6 text-purple-600" />
              </div>
            </div>
            <h3 className="text-xs md:text-sm font-medium text-gray-600 mb-1">Hoy</h3>
            <p className="text-xl md:text-3xl text-gray-900">{summary.todayCount}</p>
            <p className="text-xs text-gray-500 mt-1 md:mt-2 hidden sm:block">Ingresados hoy</p>
          </div>
        </div>
      )}

      {/* Tabs de filtro */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lista de pedidos: cards en mobile, tabla en desktop */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          </div>
        ) : orders.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No hay pedidos {activeTab === 'sent' ? 'sin pagar' : activeTab === 'sale' ? 'confirmados' : ''}</p>
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden divide-y divide-gray-200">
              {orders.map((order) => {
                const payment = getPaymentBadge(order.state);
                const delivery = getDeliveryBadge(order.delivery_status);
                return (
                  <div
                    key={order.id}
                    onClick={() => router.push(`/orders/${order.id}`)}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors active:bg-gray-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-primary-700 text-sm">{order.name}</p>
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${payment.color}`}>
                          {payment.label}
                        </span>
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${delivery.color}`}>
                          {delivery.label}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{order.partner_id[1]}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {new Date(order.date_order).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'America/Buenos_Aires',
                        })}
                      </div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {formatCurrency(order.amount_total)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">
                      Pedido
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">
                      Cliente
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">
                      Fecha
                    </th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-gray-900">
                      Total
                    </th>
                    <th className="text-center px-6 py-3 text-sm font-semibold text-gray-900">
                      Pago
                    </th>
                    <th className="text-center px-6 py-3 text-sm font-semibold text-gray-900">
                      Envío
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => {
                    const payment = getPaymentBadge(order.state);
                    const delivery = getDeliveryBadge(order.delivery_status);
                    return (
                      <tr
                        key={order.id}
                        onClick={() => router.push(`/orders/${order.id}`)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-primary-700">
                              {order.name}
                            </p>
                            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {order.partner_id[1]}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {new Date(order.date_order).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'America/Buenos_Aires',
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                          {formatCurrency(order.amount_total)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${payment.color}`}>
                            {payment.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${delivery.color}`}>
                            {delivery.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-white border-t border-gray-200">
            <div className="text-xs md:text-sm text-gray-700">
              <span className="hidden sm:inline">Mostrando </span>{(currentPage - 1) * ordersPerPage + 1}-{Math.min(currentPage * ordersPerPage, totalOrders)} de {totalOrders}
            </div>
            <div className="flex items-center space-x-1 md:space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 md:p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
              </button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-2.5 py-1.5 md:px-3 md:py-2 text-xs md:text-sm font-medium rounded-md ${
                        currentPage === pageNum
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 md:p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
