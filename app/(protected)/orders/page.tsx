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
  website_id: [number, string] | false;
}

interface Summary {
  pendingCount: number;
  totalPendingAmount: number;
  todayCount: number;
}

const getStateBadge = (state: string) => {
  const map: Record<string, { label: string; color: string }> = {
    draft: { label: 'Borrador', color: 'text-gray-600 bg-gray-100' },
    sent: { label: 'Enviado', color: 'text-blue-600 bg-blue-50' },
    sale: { label: 'Confirmado', color: 'text-yellow-700 bg-yellow-50' },
    done: { label: 'Completado', color: 'text-green-600 bg-green-50' },
    cancel: { label: 'Cancelado', color: 'text-red-600 bg-red-50' },
  };
  return map[state] || { label: state, color: 'text-gray-600 bg-gray-100' };
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

type TabFilter = 'sale' | 'done' | 'all';

export default function OrdersPage() {
  const [orders, setOrders] = useState<EcommerceOrder[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState<TabFilter>('sale');
  const router = useRouter();

  const ordersPerPage = 20;

  useEffect(() => {
    loadOrders('sale', 1);
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
    { key: 'sale', label: 'Pendientes' },
    { key: 'done', label: 'Completados' },
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl text-gray-900">Pedidos Web</h1>
        <p className="text-gray-600 mt-1">
          Pedidos del ecommerce pendientes de preparar
        </p>
      </div>

      {/* Tarjetas resumen */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              {summary.pendingCount > 0 && (
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              )}
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Pedidos Pendientes</h3>
            <p className="text-3xl text-gray-900">{summary.pendingCount}</p>
            <p className="text-sm text-gray-500 mt-2">Esperando preparación</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Monto Total Pendiente</h3>
            <p className="text-3xl text-gray-900">
              {formatCurrency(summary.totalPendingAmount)}
            </p>
            <p className="text-sm text-gray-500 mt-2">En pedidos confirmados</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Pedidos Hoy</h3>
            <p className="text-3xl text-gray-900">{summary.todayCount}</p>
            <p className="text-sm text-gray-500 mt-2">Ingresados hoy</p>
          </div>
        </div>
      )}

      {/* Tabs de filtro */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tabla de pedidos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No hay pedidos {activeTab === 'sale' ? 'pendientes' : activeTab === 'done' ? 'completados' : ''}</p>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const badge = getStateBadge(order.state);
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
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                          {formatCurrency(order.amount_total)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Mostrando {(currentPage - 1) * ordersPerPage + 1} a{' '}
              {Math.min(currentPage * ordersPerPage, totalOrders)} de {totalOrders} pedidos
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
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
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
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
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
