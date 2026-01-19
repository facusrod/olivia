'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, TrendingUp, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  list_price: number;
  qty_available: number;
}

interface TopSelling {
  id: number;
  name: string;
  totalQty: number;
}

interface SuggestionsData {
  lowStock: Product[];
  topSelling: TopSelling[];
  analysis: string;
  generatedAt: string;
}

export default function SuggestionsPage() {
  const [data, setData] = useState<SuggestionsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/purchase-suggestions');
      if (!response.ok) throw new Error('Error al cargar sugerencias');

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

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
        <p className="text-gray-600">Error al cargar sugerencias</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sugerencias de Compra
          </h1>
          <p className="text-gray-600">
            Análisis automático basado en ventas y stock disponible
          </p>
        </div>
        <button
          onClick={loadSuggestions}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Productos con Bajo Stock
              </h3>
              <p className="text-sm text-gray-600">Requieren atención urgente</p>
            </div>
          </div>
          <p className="text-4xl font-bold text-orange-600 mb-4">
            {data.lowStock.length}
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {data.lowStock.slice(0, 10).map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between bg-white p-3 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-600">
                    Precio: ${product.list_price.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-orange-600">
                    {product.qty_available} unidades
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Productos Más Vendidos
              </h3>
              <p className="text-sm text-gray-600">Últimos 30 días</p>
            </div>
          </div>
          <p className="text-4xl font-bold text-green-600 mb-4">
            Top {data.topSelling.length}
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {data.topSelling.map((product, idx) => (
              <div
                key={product.id}
                className="flex items-center gap-3 bg-white p-3 rounded-lg"
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center font-bold text-green-700 text-sm">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">
                    {product.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">
                    {product.totalQty} vendidos
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Análisis y Recomendaciones de IA
            </h3>
            <p className="text-sm text-gray-600">
              Generado por Gemini AI -{' '}
              {new Date(data.generatedAt).toLocaleString('es-ES')}
            </p>
          </div>
        </div>

        <div className="prose max-w-none">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
              {data.analysis}
            </pre>
          </div>
        </div>
      </div>

      {/* Action Note */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Nota:</strong> Estas sugerencias son generadas automáticamente
          basadas en el análisis de tus datos de ventas y stock actual. Revisa con
          tu proveedor antes de realizar órdenes de compra.
        </p>
      </div>
    </div>
  );
}
