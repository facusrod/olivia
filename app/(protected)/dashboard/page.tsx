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
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import Modal from '@/components/Modal';
import MonthlySalesChart from '@/components/MonthlySalesChart';
import ExpiredCategoryDonut from '@/components/ExpiredCategoryDonut';
import { useUserRole } from '@/lib/useUserRole';

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
    expiredMonth: { qty: number; value: number };
  };
  products: {
    topSelling: Array<{ id: number; name: string; totalQty: number; qty_available: number }>;
    slowMoving: Array<{ id: number; name: string; totalQty: number; qty_available: number }>;
    expiring: Array<{ id: number; name: string; totalQty: number; expirationDate: string; lotName: string; daysUntilExpiration: number; totalValue: number }>;
    expiredByCategory?: Array<{ category: string; qty: number; value: number }>;
  };
  salesHistory?: Array<{ month: string; pos: number; ecom: number; total: number }>;
  updatedAt: string;
}

interface PendingOrder {
  id: number;
  name: string;
  partner_id: [number, string];
  date_order: string;
  amount_total: number;
  state: string;
  delivery_status: string | false;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingSummary, setPendingSummary] = useState<{ pendingCount: number; totalPendingAmount: number } | null>(null);
  const [, setTick] = useState(0);
  const [modalType, setModalType] = useState<'expiring' | 'topSelling' | 'slowMoving' | null>(null);
  const [modalPage, setModalPage] = useState(1);
  const router = useRouter();
  const { isAdmin } = useUserRole();

  useEffect(() => {
    loadDashboard();
    loadPendingOrders();
  }, []);

  // Auto-refresh urgency indicators every 60s
  useEffect(() => {
    const interval = setInterval(() => setTick(n => n + 1), 60000);
    return () => clearInterval(interval);
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
      const [dashRes] = await Promise.all([
        fetch('/api/dashboard', { method: 'POST' }),
        loadPendingOrders(),
      ]);
      if (!dashRes.ok) throw new Error('Error al actualizar dashboard');
      const result = await dashRes.json();
      setData(result);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadPendingOrders = async () => {
    try {
      setPendingLoading(true);
      const response = await fetch('/api/orders?state=pending&limit=5');
      if (!response.ok) throw new Error('Error al cargar pedidos');
      const result = await response.json();
      setPendingOrders(result.orders);
      setPendingSummary(result.summary);
    } catch (error) {
      console.error('Error pedidos:', error);
    } finally {
      setPendingLoading(false);
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
      timeZone: 'America/Buenos_Aires',
    });

    return { dotClass, text, dateShort };
  };

  const getOrderUrgency = (dateOrder: string) => {
    const now = new Date();
    const created = new Date(dateOrder);
    const diffMs = now.getTime() - created.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    let dotClass: string;
    let textClass: string;
    let rowClass: string;
    if (diffMin < 15) {
      dotClass = 'bg-green-500';
      textClass = 'text-green-700';
      rowClass = 'bg-gray-50 border-gray-100';
    } else if (diffMin < 30) {
      dotClass = 'bg-orange-500';
      textClass = 'text-orange-700';
      rowClass = 'bg-orange-50 border-orange-200';
    } else {
      dotClass = 'bg-red-500';
      textClass = 'text-red-700';
      rowClass = 'bg-red-50 border-red-200';
    }

    let text: string;
    if (diffMin < 1) {
      text = 'Justo ahora';
    } else if (diffMin < 60) {
      text = `hace ${diffMin} min`;
    } else if (diffMin < 1440) {
      const hours = Math.floor(diffMin / 60);
      const mins = diffMin % 60;
      text = `hace ${hours}h ${mins > 0 ? `${mins}min` : ''}`;
    } else {
      const days = Math.floor(diffMin / 1440);
      text = `hace ${days}d`;
    }

    const dateShort = created.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Buenos_Aires',
    });

    return { dotClass, textClass, rowClass, text, dateShort };
  };

  const getPaymentBadge = (state: string) => {
    const map: Record<string, { label: string; color: string }> = {
      sent: { label: 'Sin Pagar', color: 'text-orange-700 bg-orange-100' },
      sale: { label: 'Pagado', color: 'text-green-700 bg-green-100' },
    };
    return map[state] || { label: state, color: 'text-gray-600 bg-gray-100' };
  };

  const getDeliveryBadge = (deliveryStatus: string | false) => {
    if (!deliveryStatus || deliveryStatus === 'no') {
      return { label: 'No Enviado', color: 'text-gray-500 bg-gray-100' };
    }
    const map: Record<string, { label: string; color: string }> = {
      partial: { label: 'Parcial', color: 'text-amber-700 bg-amber-100' },
      full: { label: 'Enviado', color: 'text-green-700 bg-green-100' },
    };
    return map[deliveryStatus] || { label: deliveryStatus, color: 'text-gray-500 bg-gray-100' };
  };

  const status = getUpdateStatus(data.updatedAt);

  const MODAL_PAGE_SIZE = 20;

  const openModal = (type: 'expiring' | 'topSelling' | 'slowMoving') => {
    setModalType(type);
    setModalPage(1);
  };

  const closeModal = () => setModalType(null);

  const getModalConfig = () => {
    if (!modalType) return null;
    const configs = {
      expiring: {
        items: data.products.expiring,
        title: 'Próximos a Vencer',
        subtitle: 'Próximos 30 días',
        icon: <CalendarClock className="w-5 h-5 text-red-600" />,
      },
      topSelling: {
        items: data.products.topSelling,
        title: 'Productos Más Vendidos',
        subtitle: 'Últimos 30 días',
        icon: <TrendingUp className="w-5 h-5 text-green-600" />,
      },
      slowMoving: {
        items: data.products.slowMoving,
        title: 'Productos con Bajas Ventas',
        subtitle: 'Mayor stock sin ventas recientes',
        icon: <TrendingDown className="w-5 h-5 text-gray-600" />,
      },
    };
    return configs[modalType];
  };

  const renderExpiringItem = (product: DashboardData['products']['expiring'][0]) => {
    const isExpired = product.daysUntilExpiration < 0;
    const isUrgent = !isExpired && product.daysUntilExpiration <= 7;
    const isWarning = !isExpired && product.daysUntilExpiration > 7 && product.daysUntilExpiration <= 15;
    const daysAgo = Math.abs(product.daysUntilExpiration);
    return (
      <div
        key={`${product.id}-${product.lotName}-${isExpired ? 'exp' : 'pend'}`}
        className={`flex items-center justify-between p-3 rounded-lg border ${
          isExpired
            ? 'bg-red-100 border-red-400'
            : isUrgent
            ? 'bg-red-50 border-red-200'
            : isWarning
            ? 'bg-orange-50 border-orange-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}
      >
        <div className="flex-1 min-w-0">
          {isExpired && (
            <span className="inline-block mb-1 px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-700 rounded">
              VENCIDO
            </span>
          )}
          <p className={`font-medium truncate text-sm md:text-base ${isExpired ? 'text-red-900' : 'text-gray-900'}`}>
            {product.name}
          </p>
          <p className="text-xs text-gray-600">Lote: {product.lotName}</p>
          <p className="text-xs text-gray-600 mt-1">
            {new Date(product.expirationDate).toLocaleDateString('es-ES', { timeZone: 'America/Buenos_Aires' })}
          </p>
        </div>
        <div className="text-right ml-3">
          {isExpired ? (
            <>
              <p className="text-xs font-semibold text-red-800">hace</p>
              <p className="text-lg font-bold text-red-800">{daysAgo}</p>
              <p className="text-xs text-red-800">{daysAgo === 1 ? 'día' : 'días'}</p>
            </>
          ) : product.daysUntilExpiration === 0 ? (
            <p className={`text-sm font-bold ${
              isUrgent ? 'text-red-600' : isWarning ? 'text-orange-600' : 'text-yellow-600'
            }`}>
              Vence hoy
            </p>
          ) : (
            <>
              <p className={`text-lg font-bold ${
                isUrgent ? 'text-red-600' : isWarning ? 'text-orange-600' : 'text-yellow-600'
              }`}>
                {product.daysUntilExpiration}
              </p>
              <p className="text-xs text-gray-600">
                {product.daysUntilExpiration === 1 ? 'día' : 'días'}
              </p>
            </>
          )}
          <p className={`text-xs mt-1 ${isExpired ? 'text-red-800 font-semibold' : 'text-gray-500'}`}>{product.totalQty} u.</p>
          <p className={`text-xs ${isExpired ? 'text-red-800 font-semibold' : 'text-gray-500'}`}>{formatCurrency(product.totalValue)}</p>
        </div>
      </div>
    );
  };

  const renderTopSellingItem = (product: DashboardData['products']['topSelling'][0], rank: number) => (
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
        {rank}
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
  );

  const renderSlowMovingItem = (product: DashboardData['products']['slowMoving'][0], rank: number) => (
    <div
      key={product.id}
      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <div className="w-7 h-7 md:w-8 md:h-8 bg-gray-400 text-white rounded-full flex items-center justify-center font-bold text-xs md:text-sm">
        {rank}
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
  );

  // ── Tarjetas reutilizables ──

  const ventasDiaCard = (
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
  );

  const ventasMesCard = (
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
  );

  const ticketPromedioCard = (
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
  );

  const valorInventarioCard = (
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
  );

  const pedidosPendientesCard = (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-base md:text-lg text-gray-900">
              Pedidos Pendientes
            </h3>
            <p className="text-xs md:text-sm text-gray-600">Requieren tu atención</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingSummary && pendingSummary.pendingCount > 0 && (
            <span className="text-xs md:text-sm text-gray-500 hidden sm:inline">
              {formatCurrency(pendingSummary.totalPendingAmount)}
            </span>
          )}
          {pendingSummary && pendingSummary.pendingCount > 0 && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              pendingOrders.some(o => {
                const diff = Math.floor((Date.now() - new Date(o.date_order).getTime()) / 60000);
                return diff > 30;
              })
                ? 'bg-red-100 text-red-700 animate-pulse'
                : 'bg-orange-100 text-orange-700'
            }`}>
              {pendingSummary.pendingCount}
            </span>
          )}
        </div>
      </div>

      {pendingLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : pendingOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No hay pedidos pendientes</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {pendingOrders.map((order) => {
              const urgency = getOrderUrgency(order.date_order);
              const payment = getPaymentBadge(order.state);
              const delivery = getDeliveryBadge(order.delivery_status);

              return (
                <div
                  key={order.id}
                  onClick={() => router.push(`/orders/${order.id}`)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-all ${urgency.rowClass}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-primary-700 text-sm">{order.name}</p>
                      <span className={`inline-block px-1.5 py-0.5 text-xs font-semibold rounded-full ${payment.color}`}>
                        {payment.label}
                      </span>
                      <span className={`inline-block px-1.5 py-0.5 text-xs font-semibold rounded-full ${delivery.color}`}>
                        {delivery.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 truncate mt-0.5">{order.partner_id[1]}</p>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="font-semibold text-gray-900 text-sm">{formatCurrency(order.amount_total)}</p>
                    <div className="flex items-center gap-1.5 justify-end mt-1">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${urgency.dotClass}`} />
                      <span className={`text-xs font-medium ${urgency.textClass}`}>{urgency.text}</span>
                      <span className="text-xs text-gray-400 hidden sm:inline">· {urgency.dateShort}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => router.push('/orders')}
            className="w-full mt-4 py-2.5 text-sm font-semibold text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            Ver todos los pedidos
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Status */}
      <button
        onClick={refreshDashboard}
        disabled={refreshing}
        className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 ml-auto"
      >
        {refreshing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <div className={`w-2 h-2 rounded-full ${status.dotClass}`} />
        )}
        <span>{status.text}</span>
        <span className="hidden sm:inline text-gray-400">· {status.dateShort}</span>
      </button>

      {isAdmin ? (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {ventasDiaCard}
          {ventasMesCard}
          {ticketPromedioCard}
          {valorInventarioCard}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:gap-6">
          {ventasDiaCard}
          {ticketPromedioCard}
        </div>
      )}

      {/* Vencido por Categoría + Pedidos Pendientes, repartidos por igual */}
      <div className={`grid grid-cols-1 gap-4 md:gap-6 ${
        data.products.expiredByCategory && data.products.expiredByCategory.length > 0 ? 'lg:grid-cols-2' : ''
      }`}>
        {pedidosPendientesCard}
        {data.products.expiredByCategory && data.products.expiredByCategory.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Layers className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base md:text-lg text-gray-900">Vencido por Categoría</h3>
                <p className="text-xs md:text-sm text-gray-600">Este mes</p>
              </div>
            </div>

            {/* Total arriba */}
            <div className="mb-4 pb-4 border-b border-gray-100">
              <p className="text-2xl md:text-3xl font-semibold text-gray-900">
                {formatCurrency(data.inventory.expiredMonth?.value || 0)}
              </p>
              <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                vencido este mes · {data.inventory.expiredMonth?.qty || 0} u.
              </p>
            </div>

            <ExpiredCategoryDonut categories={data.products.expiredByCategory} formatCurrency={formatCurrency} />
          </div>
        )}
      </div>

      {/* Grid de 3 columnas para productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Productos Próximos a Vencer */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <CalendarClock className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base md:text-lg text-gray-900">
                  Próximos a Vencer
                </h3>
                <p className="text-xs md:text-sm text-gray-600">Vencidos + próximos 30 días</p>
              </div>
            </div>
            {data.products.expiring.length > 10 && (
              <button
                onClick={() => openModal('expiring')}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {data.products.expiring.length === 0 ? (
              <div className="text-center py-6 md:py-8 text-gray-500">
                <CalendarClock className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No hay productos próximos a vencer</p>
              </div>
            ) : (
              data.products.expiring.slice(0, 10).map((product) => renderExpiringItem(product))
            )}
          </div>
        </div>
        {/* Productos Más Vendidos */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <div className="flex items-center gap-3">
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
            {data.products.topSelling.length > 10 && (
              <button
                onClick={() => openModal('topSelling')}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {data.products.topSelling.slice(0, 10).map((product, idx) => renderTopSellingItem(product, idx + 1))}
          </div>
        </div>

        {/* Productos con Bajas Ventas */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <div className="flex items-center gap-3">
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
            {data.products.slowMoving && data.products.slowMoving.length > 10 && (
              <button
                onClick={() => openModal('slowMoving')}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {data.products.slowMoving && data.products.slowMoving.length > 0 ? (
              data.products.slowMoving.slice(0, 10).map((product, idx) => renderSlowMovingItem(product, idx + 1))
            ) : (
              <div className="text-center py-6 md:py-8 text-gray-500">
                <Package className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No hay datos de productos con bajas ventas</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico histórico y heatmap — solo admin */}
      {isAdmin && data.salesHistory && data.salesHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-base md:text-lg text-gray-900">Ventas Históricas</h3>
              <p className="text-xs md:text-sm text-gray-600">PDV + Ecommerce por mes</p>
            </div>
          </div>
          <MonthlySalesChart data={data.salesHistory} />
        </div>
      )}


      {/* Modal Ver Más */}
      {modalType && (() => {
        const config = getModalConfig();
        if (!config) return null;
        const allItems = config.items;
        const totalItems = allItems.length;
        const totalPages = Math.ceil(totalItems / MODAL_PAGE_SIZE);
        const start = (modalPage - 1) * MODAL_PAGE_SIZE;
        const pageItems = allItems.slice(start, start + MODAL_PAGE_SIZE);

        return (
          <Modal
            isOpen={!!modalType}
            onClose={closeModal}
            title={config.title}
            subtitle={`${config.subtitle} · ${totalItems} productos`}
            icon={config.icon}
          >
            <div className="space-y-3">
              {modalType === 'expiring' &&
                (pageItems as DashboardData['products']['expiring']).map((product) =>
                  renderExpiringItem(product)
                )}
              {modalType === 'topSelling' &&
                (pageItems as DashboardData['products']['topSelling']).map((product, idx) =>
                  renderTopSellingItem(product, start + idx + 1)
                )}
              {modalType === 'slowMoving' &&
                (pageItems as DashboardData['products']['slowMoving']).map((product, idx) =>
                  renderSlowMovingItem(product, start + idx + 1)
                )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200">
                <span className="text-sm text-gray-500">
                  {start + 1}-{Math.min(start + MODAL_PAGE_SIZE, totalItems)} de {totalItems}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setModalPage((p) => Math.max(1, p - 1))}
                    disabled={modalPage === 1}
                    className="p-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium text-gray-700 px-2">
                    {modalPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setModalPage((p) => Math.min(totalPages, p + 1))}
                    disabled={modalPage === totalPages}
                    className="p-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Modal>
        );
      })()}

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
