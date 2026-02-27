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
  private authPromise: Promise<number> | null = null;
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

    // Cachear la promesa para evitar autenticaciones duplicadas
    // cuando múltiples queries llaman a authenticate() en paralelo
    if (!this.authPromise) {
      this.authPromise = this.doAuthenticate();
    }
    return this.authPromise;
  }

  private async doAuthenticate(): Promise<number> {
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
      // Limpiar promesa en caso de error para permitir reintentos
      this.authPromise = null;
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

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, limit);

    // Traer stock actual de los top products (1 RPC extra, solo N productos)
    const topIds = topProducts.map(p => p.id);
    if (topIds.length > 0) {
      const stockData = await this.executeKw('product.product', 'search_read', [
        [['id', 'in', topIds]],
      ], {
        fields: ['id', 'qty_available'],
        order: 'id asc',
      });
      const stockMap = new Map(stockData.map((p: any) => [p.id, p.qty_available]));
      for (const product of topProducts) {
        (product as any).qty_available = stockMap.get(product.id) || 0;
      }
    }

    return topProducts;
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
   * Obtiene totales de POS orders (count + revenue) usando read_group sin groupby.
   * Retorna una sola fila agregada. Independiente del locale de Odoo.
   */
  async getPosOrderStats(
    filters: any[]
  ): Promise<{ count: number; revenue: number }> {
    const result = await this.readGroup(
      'pos.order',
      filters,
      ['amount_total'],
      [], // sin groupby = 1 fila con totales
    );
    const row = result[0] || {};
    return {
      count: row.__count || 0,
      revenue: row.amount_total || 0,
    };
  }

  /**
   * Obtiene totales de ecommerce orders (count + revenue) usando read_group sin groupby.
   * Retorna una sola fila agregada. Independiente del locale de Odoo.
   */
  async getEcommerceOrderStats(
    filters: any[]
  ): Promise<{ count: number; revenue: number }> {
    try {
      const result = await this.readGroup(
        'sale.order',
        [['website_id', '!=', false], ...filters],
        ['amount_total'],
        [], // sin groupby = 1 fila con totales
      );
      const row = result[0] || {};
      return {
        count: row.__count || 0,
        revenue: row.amount_total || 0,
      };
    } catch (error: any) {
      console.error('Error getting ecommerce order stats:', error?.message || error);
      return { count: 0, revenue: 0 };
    }
  }

  /**
   * Obtiene productos con stock alto que no están en la lista de más vendidos.
   * qty_available es un campo calculado en Odoo (no stored), así que no se puede
   * usar en ORDER BY. Se trae todo y se ordena en memoria.
   */
  async getSlowMovingProducts(
    excludeIds: number[],
    topN: number = 5
  ): Promise<any[]> {
    const products = await this.executeKw('product.product', 'search_read', [
      [['qty_available', '>', 0], ['id', 'not in', excludeIds]],
    ], {
      fields: ['id', 'name', 'qty_available'],
      order: 'id asc', // Forzar orden por campo stored (qty_available es computed, no se puede usar en ORDER BY)
    });
    return products
      .sort((a: any, b: any) => b.qty_available - a.qty_available)
      .slice(0, topN);
  }

  /**
   * Cuenta productos que cumplen los filtros usando read_group (1 RPC, 1 fila).
   */
  async getProductCount(filters: any[] = []): Promise<number> {
    const result = await this.readGroup('product.product', filters, ['id'], []);
    return result[0]?.__count || 0;
  }

  /**
   * Calcula el valor total de inventario (list_price × qty_available) en una sola llamada.
   * Solo trae productos con stock > 0 y únicamente 2 campos.
   */
  async getInventoryValue(): Promise<number> {
    const products = await this.executeKw('product.product', 'search_read', [[['qty_available', '>', 0]]], {
      fields: ['list_price', 'qty_available'],
      order: 'id asc', // Forzar orden por campo stored (el default de product.product usa qty_available que es computed)
    });
    return products.reduce(
      (sum: number, p: any) => sum + (p.list_price * p.qty_available),
      0
    );
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

export type { OdooProduct, OdooProductLot, OdooEcommerceOrder, OdooEcommerceOrderLine };
