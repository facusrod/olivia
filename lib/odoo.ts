import axios from 'axios';
import { Readable } from 'stream';

// Importar serializer y deserializer de xmlrpc
const Serializer = require('xmlrpc/lib/serializer');
const Deserializer = require('xmlrpc/lib/deserializer');

interface OdooConfig {
  url: string;
  db: string;
  username: string;
  password: string;
}

interface OdooProduct {
  id: number;
  name: string;
  list_price: number;
  qty_available: number;
  categ_id: [number, string];
  default_code?: string;
  barcode?: string;
  description_sale?: string;
}

interface OdooProductLot {
  id: number;
  name: string;
  product_id: [number, string];
  product_qty: number;
  expiration_date?: string;
  use_date?: string;
  removal_date?: string;
}

interface OdooSaleOrder {
  id: number;
  name: string;
  partner_id: [number, string];
  date_order: string;
  amount_total: number;
  state: string;
}

interface OdooPurchaseOrder {
  id: number;
  name: string;
  partner_id: [number, string];
  date_order: string;
  amount_total: number;
  state: string;
}

interface OdooEcommerceOrder {
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
  order_line: number[];
}

interface OdooEcommerceOrderLine {
  id: number;
  product_id: [number, string];
  name: string;
  product_uom_qty: number;
  price_unit: number;
  price_subtotal: number;
}

class OdooClient {
  private config: OdooConfig;
  private uid: number | null = null;
  private cfHeaders: Record<string, string> = {};

  constructor() {
    this.config = {
      url: process.env.ODOO_URL || 'http://localhost:8069',
      db: process.env.ODOO_DB || '',
      username: process.env.ODOO_USERNAME || '',
      password: process.env.ODOO_PASSWORD || '',
    };

    // Cloudflare Zero Trust headers (solo en produccion)
    const cfClientId = process.env.CF_ACCESS_CLIENT_ID;
    const cfClientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
    if (cfClientId && cfClientSecret) {
      this.cfHeaders = {
        'CF-Access-Client-Id': cfClientId,
        'CF-Access-Client-Secret': cfClientSecret,
      };
    }
  }

  private async callXmlRpc(path: string, method: string, params: any[]): Promise<any> {
    const xml = Serializer.serializeMethodCall(method, params);
    const url = `${this.config.url}/xmlrpc/2/${path}`;

    const response = await axios.post(url, xml, {
      headers: {
        'Content-Type': 'text/xml',
        ...this.cfHeaders,
      },
      responseType: 'text',
      timeout: 60000,
    });

    // Deserializar la respuesta XML
    return new Promise((resolve, reject) => {
      const deserializer = new Deserializer();
      const stream = Readable.from([response.data]);
      deserializer.deserializeMethodResponse(stream, (error: any, result: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;

    try {
      const uid = await this.callXmlRpc('common', 'authenticate', [
        this.config.db,
        this.config.username,
        this.config.password,
        {},
      ]);

      if (!uid) {
        throw new Error('Odoo authentication failed: Invalid credentials');
      }

      this.uid = uid;
      console.log('✅ Odoo authenticated, UID:', uid);
      return uid;
    } catch (error: any) {
      throw new Error(`Odoo authentication failed: ${error?.message || error}`);
    }
  }

  private async executeKw(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: any = {}
  ): Promise<any> {
    const uid = await this.authenticate();

    try {
      return await this.callXmlRpc('object', 'execute_kw', [
        this.config.db,
        uid,
        this.config.password,
        model,
        method,
        args,
        kwargs,
      ]);
    } catch (error: any) {
      throw new Error(`Odoo ${method} failed: ${error?.message || error}`);
    }
  }

  // ========== PRODUCTOS ==========
  async getProducts(filters: any[] = [], limit: number = 100, offset: number = 0): Promise<OdooProduct[]> {
    return this.executeKw('product.product', 'search_read', [filters], {
      fields: [
        'id',
        'name',
        'list_price',
        'qty_available',
        'categ_id',
        'default_code',
        'barcode',
        'description_sale',
      ],
      limit,
      offset,
    });
  }

  async searchProducts(query: string, limit: number = 20, offset: number = 0): Promise<OdooProduct[]> {
    const filters = [
      '|',
      ['name', 'ilike', query],
      ['default_code', 'ilike', query],
    ];
    return this.getProducts(filters, limit, offset);
  }

  async getProductsByCategory(categoryName: string): Promise<OdooProduct[]> {
    // Primero buscar la categoría
    const categories = await this.executeKw('product.category', 'search_read', [
      [['name', 'ilike', categoryName]],
    ], { fields: ['id', 'name'], limit: 1 });

    if (categories.length === 0) return [];

    // Luego buscar productos de esa categoría
    return this.getProducts([['categ_id', '=', categories[0].id]]);
  }

  async getProductById(id: number): Promise<OdooProduct | null> {
    const products = await this.executeKw('product.product', 'search_read', [
      [['id', '=', id]],
    ], {
      fields: [
        'id',
        'name',
        'list_price',
        'qty_available',
        'categ_id',
        'default_code',
        'barcode',
        'description_sale',
      ],
      limit: 1,
    });
    return products.length > 0 ? products[0] : null;
  }

  /**
   * Obtiene TODOS los productos paginando automáticamente.
   * Odoo limita las respuestas, así que hacemos múltiples llamadas.
   */
  async getAllProducts(filters: any[] = []): Promise<OdooProduct[]> {
    const PAGE_SIZE = 200;
    let offset = 0;
    let allProducts: OdooProduct[] = [];

    while (true) {
      const batch = await this.getProducts(filters, PAGE_SIZE, offset);
      allProducts = allProducts.concat(batch);

      if (batch.length < PAGE_SIZE) {
        // Ya no hay más páginas
        break;
      }
      offset += PAGE_SIZE;
    }

    console.log(`📦 getAllProducts: ${allProducts.length} productos obtenidos (${Math.ceil(offset / PAGE_SIZE) + 1} páginas)`);
    return allProducts;
  }

  // ========== ÓRDENES DE VENTA ==========
  async getSaleOrders(filters: any[] = [], limit: number = 100): Promise<OdooSaleOrder[]> {
    return this.executeKw('sale.order', 'search_read', [filters], {
      fields: ['id', 'name', 'partner_id', 'date_order', 'amount_total', 'state'],
      limit,
      order: 'date_order desc',
    });
  }

  async getRecentSales(days: number = 30): Promise<OdooSaleOrder[]> {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const dateStr = date.toISOString().split('T')[0];

    return this.getSaleOrders([['date_order', '>=', dateStr]]);
  }

  async getSaleOrderLines(orderId: number): Promise<any[]> {
    return this.executeKw('sale.order.line', 'search_read', [
      [['order_id', '=', orderId]],
    ], {
      fields: ['product_id', 'product_uom_qty', 'price_unit', 'price_subtotal'],
    });
  }

  // ========== ÓRDENES DE COMPRA ==========
  async getPurchaseOrders(filters: any[] = [], limit: number = 100): Promise<OdooPurchaseOrder[]> {
    return this.executeKw('purchase.order', 'search_read', [filters], {
      fields: ['id', 'name', 'partner_id', 'date_order', 'amount_total', 'state'],
      limit,
      order: 'date_order desc',
    });
  }

  async createPurchaseOrder(data: {
    partnerId: number;
    lines: Array<{ productId: number; quantity: number; price: number }>;
  }): Promise<number> {
    const orderLines = data.lines.map((line) => [
      0,
      0,
      {
        product_id: line.productId,
        product_qty: line.quantity,
        price_unit: line.price,
      },
    ]);

    const orderId = await this.executeKw('purchase.order', 'create', [
      {
        partner_id: data.partnerId,
        order_line: orderLines,
      },
    ]);

    return orderId;
  }

  // ========== ANÁLISIS Y SUGERENCIAS ==========
  async getLowStockProducts(threshold: number = 10): Promise<OdooProduct[]> {
    return this.getProducts([['qty_available', '<=', threshold]]);
  }

  async getExpiringProducts(daysThreshold: number = 30, limit: number = 10): Promise<any[]> {
    try {
      const now = new Date();
      const thresholdDate = new Date();
      thresholdDate.setDate(now.getDate() + daysThreshold);

      const nowStr = now.toISOString().split('T')[0];
      const thresholdStr = thresholdDate.toISOString().split('T')[0];

      const lots: OdooProductLot[] = await this.executeKw('stock.lot', 'search_read', [
        [
          '|', '|',
          ['expiration_date', '!=', false],
          ['use_date', '!=', false],
          ['removal_date', '!=', false],
          '|', '|',
          '&', ['expiration_date', '>=', nowStr], ['expiration_date', '<=', thresholdStr],
          '&', ['use_date', '>=', nowStr], ['use_date', '<=', thresholdStr],
          '&', ['removal_date', '>=', nowStr], ['removal_date', '<=', thresholdStr],
          ['product_qty', '>', 0]
        ],
      ], {
        fields: ['id', 'name', 'product_id', 'product_qty', 'expiration_date', 'use_date', 'removal_date'],
        limit: limit * 3,
        order: 'expiration_date asc, use_date asc, removal_date asc',
      });

      if (!lots || lots.length === 0) {
        return [];
      }

      const productMap: { [key: number]: any } = {};

      for (const lot of lots) {
        const productId = lot.product_id[0];
        const productName = lot.product_id[1];
        const expirationDate = lot.expiration_date || lot.use_date || lot.removal_date;

        if (!expirationDate) continue;

        if (!productMap[productId]) {
          productMap[productId] = {
            id: productId,
            name: productName,
            totalQty: 0,
            expirationDate: expirationDate,
            lotName: lot.name,
            daysUntilExpiration: 0
          };
        } else {
          if (expirationDate < productMap[productId].expirationDate) {
            productMap[productId].expirationDate = expirationDate;
            productMap[productId].lotName = lot.name;
          }
        }

        productMap[productId].totalQty += lot.product_qty;
      }

      const products = Object.values(productMap).map(product => {
        const expDate = new Date(product.expirationDate);
        const diffTime = expDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
          ...product,
          daysUntilExpiration: diffDays
        };
      });

      return products
        .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration)
        .slice(0, limit);

    } catch (error: any) {
      console.error('Error getting expiring products:', error?.message || error);
      return [];
    }
  }

  async getTopSellingProducts(days: number = 30, limit: number = 10): Promise<any[]> {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const dateStr = date.toISOString().split('T')[0];

    const orderLines = await this.executeKw('pos.order.line', 'search_read', [
      [['order_id.date_order', '>=', dateStr], ['order_id.state', 'in', ['paid', 'done', 'invoiced']]],
    ], {
      fields: ['product_id', 'qty'],
    });

    if (!orderLines || orderLines.length === 0) {
      return [];
    }

    const productSales: { [key: number]: { id: number; name: string; totalQty: number } } = {};

    for (const line of orderLines) {
      const productId = line.product_id[0];
      const productName = line.product_id[1];
      const quantity = line.qty || 0;

      if (!productSales[productId]) {
        productSales[productId] = {
          id: productId,
          name: productName,
          totalQty: 0,
        };
      }
      productSales[productId].totalQty += quantity;
    }

    return Object.values(productSales)
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, limit);
  }

  // ========== PEDIDOS WEB / ECOMMERCE ==========

  /**
   * Obtiene pedidos del ecommerce (sale.order con website_id != false).
   * Requiere módulo website_sale instalado en Odoo.
   */
  async getEcommerceOrders(
    extraFilters: any[] = [],
    limit: number = 100,
    offset: number = 0
  ): Promise<OdooEcommerceOrder[]> {
    const baseFilters = [
      ['website_id', '!=', false],
      ...extraFilters,
    ];
    return this.executeKw('sale.order', 'search_read', [baseFilters], {
      fields: [
        'id', 'name', 'partner_id', 'partner_shipping_id',
        'date_order', 'commitment_date', 'amount_total',
        'state', 'website_id', 'note', 'order_line',
      ],
      limit,
      offset,
      order: 'date_order desc',
    });
  }

  /**
   * Cuenta pedidos ecommerce (para paginación eficiente).
   */
  async countEcommerceOrders(extraFilters: any[] = []): Promise<number> {
    const baseFilters = [
      ['website_id', '!=', false],
      ...extraFilters,
    ];
    return this.executeKw('sale.order', 'search_count', [baseFilters]);
  }

  // Obtiene TODOS los pedidos ecommerce paginando automáticamente
  async getAllEcommerceOrders(extraFilters: any[] = []): Promise<OdooEcommerceOrder[]> {
    const PAGE_SIZE = 200;
    let offset = 0;
    let allOrders: OdooEcommerceOrder[] = [];

    while (true) {
      const batch = await this.getEcommerceOrders(extraFilters, PAGE_SIZE, offset);
      allOrders = allOrders.concat(batch);

      if (batch.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }

    console.log(`🌐 getAllEcommerceOrders: ${allOrders.length} órdenes obtenidas`);
    return allOrders;
  }

  /**
   * Obtiene un pedido ecommerce por ID.
   */
  async getEcommerceOrderById(id: number): Promise<OdooEcommerceOrder | null> {
    const orders = await this.executeKw('sale.order', 'search_read', [
      [['id', '=', id]],
    ], {
      fields: [
        'id', 'name', 'partner_id', 'partner_shipping_id',
        'date_order', 'commitment_date', 'amount_total',
        'state', 'website_id', 'note', 'order_line',
      ],
      limit: 1,
    });
    return orders.length > 0 ? orders[0] : null;
  }

  /**
   * Obtiene las líneas de un pedido con detalle de producto.
   */
  async getEcommerceOrderLines(orderId: number): Promise<OdooEcommerceOrderLine[]> {
    return this.executeKw('sale.order.line', 'search_read', [
      [['order_id', '=', orderId]],
    ], {
      fields: [
        'id', 'product_id', 'name', 'product_uom_qty',
        'price_unit', 'price_subtotal',
      ],
    });
  }

  // ========== AGREGACIÓN (read_group) ==========

  /**
   * Ejecuta read_group en un modelo de Odoo (equivalente a SELECT ... GROUP BY en SQL).
   * Retorna datos agregados sin traer registros individuales.
   */
  async readGroup(
    model: string,
    filters: any[],
    fields: string[],
    groupby: string[],
    kwargs?: { lazy?: boolean; orderby?: string }
  ): Promise<any[]> {
    return this.executeKw(model, 'read_group', [filters], {
      fields,
      groupby,
      lazy: kwargs?.lazy ?? false,
      ...(kwargs?.orderby ? { orderby: kwargs.orderby } : {}),
    });
  }

  /**
   * Obtiene estadísticas de POS orders agrupadas por día.
   * Retorna [{date, count, revenue}] usando read_group (sin traer registros individuales).
   */
  async getPosOrderStats(
    filters: any[]
  ): Promise<Array<{ date: string; count: number; revenue: number }>> {
    const result = await this.readGroup(
      'pos.order',
      filters,
      ['amount_total', 'date_order'],
      ['date_order:day'],
    );

    return result.map((row: any) => ({
      date: row['date_order:day'] || '',
      count: row.__count || row.date_order_count || 0,
      revenue: row.amount_total || 0,
    }));
  }

  /**
   * Obtiene estadísticas de ecommerce orders agrupadas por día.
   * Retorna [{date, count, revenue}] usando read_group (sin traer registros individuales).
   */
  async getEcommerceOrderStats(
    filters: any[]
  ): Promise<Array<{ date: string; count: number; revenue: number }>> {
    try {
      const result = await this.readGroup(
        'sale.order',
        [['website_id', '!=', false], ...filters],
        ['amount_total', 'date_order'],
        ['date_order:day'],
      );

      return result.map((row: any) => ({
        date: row['date_order:day'] || '',
        count: row.__count || row.date_order_count || 0,
        revenue: row.amount_total || 0,
      }));
    } catch (error: any) {
      console.error('Error getting ecommerce order stats:', error?.message || error);
      return [];
    }
  }

  /**
   * Obtiene todos los productos con campos mínimos para cálculos de inventario.
   * Solo trae: id, name, list_price, qty_available (elimina categ_id, barcode, etc.)
   */
  async getProductsForInventory(filters: any[] = []): Promise<any[]> {
    const PAGE_SIZE = 200;
    let offset = 0;
    let allProducts: any[] = [];

    while (true) {
      const batch = await this.executeKw('product.product', 'search_read', [filters], {
        fields: ['id', 'name', 'list_price', 'qty_available'],
        limit: PAGE_SIZE,
        offset,
      });
      allProducts = allProducts.concat(batch);

      if (batch.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }

    console.log(`📦 getProductsForInventory: ${allProducts.length} productos (campos mínimos)`);
    return allProducts;
  }

  // ========== PROVEEDORES ==========
  async getSuppliers(limit: number = 100): Promise<any[]> {
    return this.executeKw('res.partner', 'search_read', [
      [['supplier_rank', '>', 0]],
    ], {
      fields: ['id', 'name', 'email', 'phone'],
      limit,
    });
  }
}

// Singleton instance
let odooClient: OdooClient | null = null;

export function getOdooClient(): OdooClient {
  if (!odooClient) {
    odooClient = new OdooClient();
  }
  return odooClient;
}

export type { OdooProduct, OdooSaleOrder, OdooPurchaseOrder, OdooProductLot, OdooEcommerceOrder, OdooEcommerceOrderLine };
