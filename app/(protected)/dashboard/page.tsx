'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  AlertTriangle,
  Loader2,
  MessageSquare,
  Sparkles,
  Receipt,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CalendarClock,
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
  };
  inventory: {
    lowStock: number;
    outOfStock: number;
    totalValue: number;
    expiringSoon: number;
  };
  products: {
    topSelling: Array<{ id: number; name: string; totalQty: number }>;
    lowStock: Array<{ id: number; name: string; qty_available: number; list_price: number }>;
    slowMoving: Array<{ id: number; name: string; qty_available: number }>;
    expiring: Array<{ id: number; name: string; totalQty: number; expirationDate: string; lotName: string; daysUntilExpiration: number }>;
  };
  updatedAt: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadDashboard();
  }, []);

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
    return new Intl.NumberFormat('es-AR', { // Use 'es-AR' for Argentina
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0, // Usually shows cents
    maximumFractionDigits: 0, // Usually shows cents
    currencyDisplay: 'symbol' // Or 'code' (ARS) or 'name' (Pesos argentinos)
  }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-ES').format(value);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Vista general de tu negocio
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          Actualizado: {new Date(data.updatedAt).toLocaleString('es-ES')}
        </div>
      </div>

      {/* Métricas Principales - Ventas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Ventas del Día */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Ventas del Día</h3>
          <p className="text-3xl text-gray-900">
            {formatCurrency(data.sales.today)}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {data.orders.today} órdenes hoy
          </p>
        </div>

        {/* Ventas del Mes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            {data.sales.growthPercentage >= 0 ? (
              <div className="flex items-center gap-1 text-green-600">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-sm font-semibold">
                  +{data.sales.growthPercentage.toFixed(1)}%
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-600">
                <ArrowDownRight className="w-4 h-4" />
                <span className="text-sm font-semibold">
                  {data.sales.growthPercentage.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Ventas del Mes</h3>
          <p className="text-3xl text-gray-900">
            {formatCurrency(data.sales.month)}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            vs {formatCurrency(data.sales.lastMonth)} mes anterior
          </p>
        </div>

        {/* Ticket Promedio */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Receipt className="w-6 h-6 text-purple-600" />
            </div>
            <ShoppingCart className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Ticket Promedio</h3>
          <p className="text-3xl text-gray-900">
            {formatCurrency(data.sales.averageTicket)}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {data.orders.month} órdenes este mes
          </p>
        </div>

        {/* Valor del Inventario */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex items-center gap-1">
              {data.inventory.lowStock > 0 && (
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              )}
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Valor Inventario</h3>
          <p className="text-3xl text-gray-900">
            {formatCurrency(data.inventory.totalValue)}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {data.inventory.lowStock} productos bajo stock
          </p>
        </div>
      </div>

      {/* Alertas de Inventario */}
      {(data.inventory.lowStock > 0 || data.inventory.outOfStock > 0 || data.inventory.expiringSoon > 0) && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg text-gray-900 mb-2">
                Alerta de Inventario
              </h3>
              <div className="flex flex-wrap gap-4 text-sm">
                {data.inventory.expiringSoon > 0 && (
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-red-600" />
                    <span className="text-gray-700">
                      <strong>{data.inventory.expiringSoon}</strong> productos próximos a vencer
                    </span>
                  </div>
                )}
                {data.inventory.lowStock > 0 && (
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-orange-600" />
                    <span className="text-gray-700">
                      <strong>{data.inventory.lowStock}</strong> productos con bajo stock
                    </span>
                  </div>
                )}
                {data.inventory.outOfStock > 0 && (
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-red-600" />
                    <span className="text-gray-700">
                      <strong>{data.inventory.outOfStock}</strong> productos agotados
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => router.push('/suggestions')}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-semibold"
            >
              Ver Sugerencias
            </button>
          </div>
        </div>
      )}

      {/* Grid de 3 columnas para productos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Productos Próximos a Vencer */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg text-gray-900">
                Próximos a Vencer
              </h3>
              <p className="text-sm text-gray-600">Próximos 30 días</p>
            </div>
          </div>
          <div className="space-y-3">
            {data.products.expiring.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CalendarClock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay productos próximos a vencer</p>
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
                      <p className="font-medium text-gray-900 truncate">
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg text-gray-900">
                Productos Más Vendidos
              </h3>
              <p className="text-sm text-gray-600">Últimos 30 días</p>
            </div>
          </div>
          <div className="space-y-3">
            {data.products.topSelling.map((product, idx) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {product.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatNumber(product.totalQty)} unidades vendidas
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Productos con Bajo Stock */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg text-gray-900">
                Productos con Bajo Stock
              </h3>
              <p className="text-sm text-gray-600">Requieren atención urgente</p>
            </div>
          </div>
          <div className="space-y-3">
            {data.products.lowStock.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>¡Excelente! No hay productos con bajo stock</p>
              </div>
            ) : (
              data.products.lowStock.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {product.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      Precio: {formatCurrency(product.list_price)}
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-lg font-bold text-orange-600">
                      {product.qty_available}
                    </p>
                    <p className="text-xs text-gray-600">unidades</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Accesos Rápidos */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg text-gray-900 mb-4">
          Accesos Rápidos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/chat')}
            className="flex items-center gap-3 p-4 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors text-left"
          >
            <MessageSquare className="w-6 h-6 text-primary-600" />
            <div>
              <p className="font-semibold text-gray-900">Chat con OlivIA</p>
              <p className="text-sm text-gray-600">Pregunta sobre tu negocio</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/suggestions')}
            className="flex items-center gap-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-left"
          >
            <Sparkles className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-semibold text-gray-900">Sugerencias IA</p>
              <p className="text-sm text-gray-600">Recomendaciones de compra</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/products')}
            className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-left"
          >
            <Package className="w-6 h-6 text-blue-600" />
            <div>
              <p className="font-semibold text-gray-900">Ver Productos</p>
              <p className="text-sm text-gray-600">Gestiona tu inventario</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
