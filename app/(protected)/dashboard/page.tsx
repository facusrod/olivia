'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  Loader2,
  MessageSquare,
  Sparkles,
  Receipt,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  CalendarClock,
  ClipboardList,
  Store,
  Globe,
} from 'lucide-react';

interface DashboardData {
  sales: {
    today: number;
    month: number;
    lastMonth: number;
    growthPercentage: number;
    averageTicket: number;
  };
  orders: {
    today: number;
    month: number;
    pos?: {
      today: number;
      month: number;
      revenueToday: number;
      revenueMonth: number;
    };
    ecommerce?: {
      today: number;
      month: number;
      revenueToday: number;
      revenueMonth: number;
    };
  };
  inventory: {
    outOfStock: number;
    totalValue: number;
    expiringSoon: number;
    totalProducts: number;
  };
  products: {
    topSelling: Array<{ id: number; name: string; totalQty: number; qty_available: number }>;
    slowMoving: Array<{ id: number; name: string; totalQty: number; qty_available: number }>;
    expiring: Array<{ id: number; name: string; totalQty: number; expirationDate: string; lotName: string; daysUntilExpiration: number }>;
  };
  updatedAt: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadDashboard();
  }, []);

  // GET - Carga el último snapshot guardado
  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard');
      if (!response.ok) throw new Error('Error al cargar dashboard');

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // POST - Regenera todo el dashboard desde Odoo
  const refreshDashboard = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/dashboard', { method: 'POST' });
      if (!response.ok) throw new Error('Error al actualizar dashboard');

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Error al cargar el dashboard</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    currencyDisplay: 'symbol'
  }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-ES').format(value);
  };

  const getUpdateStatus = (updatedAt: string) => {
    const now = new Date();
    const updated = new Date(updatedAt);
    const diffMs = now.getTime() - updated.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    let dotClass: string;
    if (diffMin < 15) {
      dotClass = 'bg-green-500';
    } else if (diffMin < 30) {
      dotClass = 'bg-yellow-500';
    } else {
      dotClass = 'bg-red-500';
    }

    let text: string;
    if (diffMin < 1) {
      text = 'Justo ahora';
    } else if (diffMin < 60) {
      text = `hace ${diffMin} min`;
    } else {
      const hours = Math.floor(diffMin / 60);
      text = `hace ${hours}h ${diffMin % 60}min`;
    }

    const dateShort = updated.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    return { dotClass, text, dateShort };
  };

  const status = getUpdateStatus(data.updatedAt);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Status */}
      <button
        onClick={refreshDashboard}
        disabled={refreshing}
        className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
      >
        {refreshing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <div className={`w-2 h-2 rounded-full ${status.dotClass}`} />
        )}
        <span>{status.text}</span>
        <span className="hidden sm:inline text-gray-400">· {status.dateShort}</span>
      </button>

      {/* Métricas Principales - Ventas */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {/* Ventas del Día */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
            </div>
            <Calendar className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
          </div>
          <h3 className="text-xs md:text-sm font-medium text-gray-600 mb-1">Ventas del Día</h3>
          <p className="text-xl md:text-3xl text-gray-900">
            {formatCurrency(data.sales.today)}
          </p>
          <p className="text-xs md:text-sm text-gray-500 mt-1 md:mt-2">
            {data.orders.today} órdenes hoy
          </p>
          {(data.orders.pos || data.orders.ecommerce) && (
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              {data.orders.pos && (
                <span className="flex items-center gap-1">
                  <Store className="w-3 h-3" />
                  {data.orders.pos.today} PDV
                </span>
              )}
              {data.orders.ecommerce && (
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {data.orders.ecommerce.today} Web
                </span>
              )}
            </div>
          )}
        </div>

        {/* Ventas del Mes */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            </div>
            {data.sales.growthPercentage >= 0 ? (
              <div className="flex items-center gap-1 text-green-600">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-xs md:text-sm font-semibold">
                  +{data.sales.growthPercentage.toFixed(1)}%
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-600">
                <ArrowDownRight className="w-4 h-4" />
                <span className="text-xs md:text-sm font-semibold">
                  {data.sales.growthPercentage.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <h3 className="text-xs md:text-sm font-medium text-gray-600 mb-1">Ventas del Mes</h3>
          <p className="text-xl md:text-3xl text-gray-900">
            {formatCurrency(data.sales.month)}
          </p>
          <p className="text-xs md:text-sm text-gray-500 mt-1 md:mt-2">
            vs {formatCurrency(data.sales.lastMonth)} mes anterior
          </p>
        </div>

        {/* Ticket Promedio */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
            </div>
            <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
          </div>
          <h3 className="text-xs md:text-sm font-medium text-gray-600 mb-1">Ticket Promedio</h3>
          <p className="text-xl md:text-3xl text-gray-900">
            {formatCurrency(data.sales.averageTicket)}
          </p>
          <p className="text-xs md:text-sm text-gray-500 mt-1 md:mt-2">
            {data.orders.month} órdenes este mes
          </p>
          {(data.orders.pos || data.orders.ecommerce) && (
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              {data.orders.pos && (
                <span className="flex items-center gap-1">
                  <Store className="w-3 h-3" />
                  {data.orders.pos.month} PDV
                </span>
              )}
              {data.orders.ecommerce && (
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {data.orders.ecommerce.month} Web
                </span>
              )}
            </div>
          )}
        </div>

        {/* Valor del Inventario */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
            </div>
            <div className="flex items-center gap-1">
              {data.inventory.outOfStock > 0 && (
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
          </div>
          <h3 className="text-xs md:text-sm font-medium text-gray-600 mb-1">Valor Inventario</h3>
          <p className="text-xl md:text-3xl text-gray-900">
            {formatCurrency(data.inventory.totalValue)}
          </p>
          <p className="text-xs md:text-sm text-gray-500 mt-1 md:mt-2">
            {formatNumber(data.inventory.totalProducts || 0)} productos · {data.inventory.outOfStock} agotados
          </p>
        </div>
      </div>

      {/* Grid de 3 columnas para productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Productos Próximos a Vencer */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <CalendarClock className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-base md:text-lg text-gray-900">
                Próximos a Vencer
              </h3>
              <p className="text-xs md:text-sm text-gray-600">Próximos 30 días</p>
            </div>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {data.products.expiring.length === 0 ? (
              <div className="text-center py-6 md:py-8 text-gray-500">
                <CalendarClock className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No hay productos próximos a vencer</p>
              </div>
            ) : (
              data.products.expiring.map((product) => {
                const isUrgent = product.daysUntilExpiration <= 7;
                const isWarning = product.daysUntilExpiration > 7 && product.daysUntilExpiration <= 15;

                return (
                  <div
                    key={`${product.id}-${product.lotName}`}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isUrgent
                        ? 'bg-red-50 border-red-200'
                        : isWarning
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm md:text-base">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        Lote: {product.lotName}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(product.expirationDate).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className={`text-lg font-bold ${
                        isUrgent
                          ? 'text-red-600'
                          : isWarning
                          ? 'text-orange-600'
                          : 'text-yellow-600'
                      }`}>
                        {product.daysUntilExpiration}
                      </p>
                      <p className="text-xs text-gray-600">
                        {product.daysUntilExpiration === 1 ? 'día' : 'días'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {product.totalQty} u.
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        {/* Productos Más Vendidos */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-base md:text-lg text-gray-900">
                Productos Más Vendidos
              </h3>
              <p className="text-xs md:text-sm text-gray-600">Últimos 30 días</p>
            </div>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {data.products.topSelling.map((product, idx) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className={`w-7 h-7 md:w-8 md:h-8 text-white rounded-full flex items-center justify-center font-bold text-xs md:text-sm ${
                  product.qty_available < 3
                    ? 'bg-red-600'
                    : product.qty_available < 5
                    ? 'bg-orange-500'
                    : 'bg-green-600'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm md:text-base">
                    {product.name}
                  </p>
                  <p className="text-xs md:text-sm text-gray-600">
                    {formatNumber(product.totalQty)} vendidas · {formatNumber(product.qty_available)} en stock
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Productos con Bajas Ventas */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="text-base md:text-lg text-gray-900">
                Productos con Bajas Ventas
              </h3>
              <p className="text-xs md:text-sm text-gray-600">Mayor stock sin ventas recientes</p>
            </div>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {data.products.slowMoving && data.products.slowMoving.length > 0 ? (
              data.products.slowMoving.map((product, idx) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-7 h-7 md:w-8 md:h-8 bg-gray-400 text-white rounded-full flex items-center justify-center font-bold text-xs md:text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate text-sm md:text-base">
                      {product.name}
                    </p>
                    <p className="text-xs md:text-sm text-gray-600">
                      {formatNumber(product.totalQty)} vendidas · {formatNumber(product.qty_available)} en stock
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 md:py-8 text-gray-500">
                <Package className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No hay datos de productos con bajas ventas</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Accesos Rápidos */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <h3 className="text-base md:text-lg text-gray-900 mb-3 md:mb-4">
          Accesos Rápidos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <button
            onClick={() => router.push('/chat')}
            className="flex items-center gap-3 p-3 md:p-4 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors text-left"
          >
            <MessageSquare className="w-5 h-5 md:w-6 md:h-6 text-primary-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-900 text-sm md:text-base">Chat con OlivIA</p>
              <p className="text-xs md:text-sm text-gray-600">Pregunta sobre tu negocio</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/suggestions')}
            className="flex items-center gap-3 p-3 md:p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-left"
          >
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-900 text-sm md:text-base">Sugerencias IA</p>
              <p className="text-xs md:text-sm text-gray-600">Recomendaciones de compra</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/orders')}
            className="flex items-center gap-3 p-3 md:p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-left"
          >
            <ClipboardList className="w-5 h-5 md:w-6 md:h-6 text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-900 text-sm md:text-base">Pedidos Web</p>
              <p className="text-xs md:text-sm text-gray-600">Pedidos ecommerce por preparar</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
