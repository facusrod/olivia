'use client';

import { useState, useEffect } from 'react';
import { Search, Package, AlertCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  list_price: number;
  qty_available: number;
  categ_id: [number, string];
  default_code?: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const productsPerPage = 20;

  useEffect(() => {
    loadProducts(undefined, 1);
  }, []);

  const loadProducts = async (query?: string, page: number = 1) => {
    try {
      setSearching(!!query);
      const offset = (page - 1) * productsPerPage;
      const url = query
        ? `/api/products?q=${encodeURIComponent(query)}&limit=${productsPerPage}&offset=${offset}`
        : `/api/products?limit=${productsPerPage}&offset=${offset}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Error al cargar productos');

      const data = await response.json();
      setProducts(data.products);
      setTotalProducts(data.total);
      setHasMore(data.hasMore);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  const handlePageChange = (page: number) => {
    if (searchQuery.trim()) {
      loadProducts(searchQuery, page);
    } else {
      loadProducts(undefined, page);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      loadProducts(searchQuery, 1);
    } else {
      loadProducts(undefined, 1);
    }
  };

  const totalPages = Math.ceil(totalProducts / productsPerPage);

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { label: 'Sin stock', color: 'text-red-600 bg-red-50' };
    if (qty <= 10) return { label: 'Stock bajo', color: 'text-orange-600 bg-orange-50' };
    return { label: 'Disponible', color: 'text-green-600 bg-green-50' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl text-gray-900 mb-2">Productos</h1>
        <p className="text-gray-600">
          Gestiona y visualiza el inventario de tu tienda
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3 max-w-2xl">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar productos por nombre o código..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Productos</p>
              <p className="text-2xl font-bold text-gray-900">{products.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Con Stock</p>
              <p className="text-2xl font-bold text-gray-900">
                {products.filter((p) => p.qty_available > 0).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Stock Bajo</p>
              <p className="text-2xl font-bold text-gray-900">
                {products.filter((p) => p.qty_available > 0 && p.qty_available <= 10).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">
                  Producto
                </th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">
                  Categoría
                </th>
                <th className="text-right px-6 py-3 text-sm font-semibold text-gray-900">
                  Precio
                </th>
                <th className="text-right px-6 py-3 text-sm font-semibold text-gray-900">
                  Stock
                </th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-gray-900">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No se encontraron productos
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const status = getStockStatus(product.qty_available);
                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          {product.default_code && (
                            <p className="text-sm text-gray-500">
                              Código: {product.default_code}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {product.categ_id[1]}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        ${product.list_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {product.qty_available}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Mostrando {((currentPage - 1) * productsPerPage) + 1} a {Math.min(currentPage * productsPerPage, totalProducts)} de {totalProducts} productos
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
