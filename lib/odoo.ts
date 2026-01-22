import xmlrpc from 'xmlrpc';

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

class OdooClient {
  private config: OdooConfig;
  private uid: number | null = null;

  constructor() {
    this.config = {
      url: process.env.ODOO_URL || 'http://localhost:8069',
      db: process.env.ODOO_DB || '',
      username: process.env.ODOO_USERNAME || '',
      password: process.env.ODOO_PASSWORD || '',
    };
  }

  private getClient(path: string): xmlrpc.Client {
    const url = new URL(this.config.url);
    return xmlrpc.createClient({
      host: url.hostname,
      port: parseInt(url.port) || 8069,
      path: `/xmlrpc/2/${path}`,
    });
  }

  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;

    return new Promise((resolve, reject) => {
      const client = this.getClient('common');
      client.methodCall(
        'authenticate',
        [this.config.db, this.config.username, this.config.password, {}],
        (error: any, uid: number) => {
          if (error) {
            reject(new Error(`Odoo authentication failed: ${error?.message || error}`));
          } else if (!uid) {
            reject(new Error('Odoo authentication failed: Invalid credentials'));
          } else {
            this.uid = uid;
            console.log('✅ Odoo authenticated, UID:', uid);
            resolve(uid);
          }
        }
      );
    });
  }

  private async executeKw(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: any = {}
  ): Promise<any> {
    const uid = await this.authenticate();

    return new Promise((resolve, reject) => {
      const client = this.getClient('object');
      client.methodCall(
        'execute_kw',
        [
          this.config.db,
          uid,
          this.config.password,
          model,
          method,
          args,
          kwargs,
        ],
        (error: any, result: any) => {
          if (error) {
            reject(new Error(`Odoo ${method} failed: ${error?.message || error}`));
          } else {
            resolve(result);
          }
        }
      );
    });
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

  // Método genérico para obtener órdenes (intenta POS primero, luego Sales)
  async getOrders(filters: any[] = [], limit: number = 100): Promise<any[]> {
    try {
      // Intentar primero con POS orders
      const posOrders = await this.executeKw('pos.order', 'search_read', [filters], {
        fields: ['id', 'name', 'partner_id', 'date_order', 'amount_total', 'state'],
        limit,
        order: 'date_order desc',
      });
      return posOrders;
    } catch (posError) {
      // Si falla POS, intentar con Sale Orders
      try {
        const saleOrders = await this.executeKw('sale.order', 'search_read', [filters], {
          fields: ['id', 'name', 'partner_id', 'date_order', 'amount_total', 'state'],
          limit,
          order: 'date_order desc',
        });
        return saleOrders;
      } catch (saleError) {
        console.error('Error getting orders from both POS and Sales:', { posError, saleError });
        // Retornar array vacío si ambos fallan
        return [];
      }
    }
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
      // Calcular la fecha límite (hoy + daysThreshold)
      const now = new Date();
      const thresholdDate = new Date();
      thresholdDate.setDate(now.getDate() + daysThreshold);

      const nowStr = now.toISOString().split('T')[0];
      const thresholdStr = thresholdDate.toISOString().split('T')[0];

      // Buscar lotes con fecha de vencimiento próxima
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
        limit: limit * 3, // Obtener más para agrupar por producto
        order: 'expiration_date asc, use_date asc, removal_date asc',
      });

      if (!lots || lots.length === 0) {
        return [];
      }

      // Agrupar por producto y sumar cantidades
      const productMap: { [key: number]: any } = {};

      for (const lot of lots) {
        const productId = lot.product_id[0];
        const productName = lot.product_id[1];

        // Determinar la fecha de vencimiento más próxima
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
          // Si encontramos una fecha más cercana, actualizamos
          if (expirationDate < productMap[productId].expirationDate) {
            productMap[productId].expirationDate = expirationDate;
            productMap[productId].lotName = lot.name;
          }
        }

        productMap[productId].totalQty += lot.product_qty;
      }

      // Calcular días hasta vencimiento y ordenar
      const products = Object.values(productMap).map(product => {
        const expDate = new Date(product.expirationDate);
        const diffTime = expDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
          ...product,
          daysUntilExpiration: diffDays
        };
      });

      // Ordenar por días hasta vencimiento (más urgentes primero)
      return products
        .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration)
        .slice(0, limit);

    } catch (error: any) {
      console.error('Error getting expiring products:', error?.message || error);
      // Si el módulo de lotes no está disponible, retornar array vacío
      return [];
    }
  }

  async getTopSellingProducts(days: number = 30, limit: number = 10): Promise<any[]> {
    try {
      // Obtener fecha de inicio
      const date = new Date();
      date.setDate(date.getDate() - days);
      const dateStr = date.toISOString().split('T')[0];

      // Intentar primero con Point of Sale (pos.order.line)
      let orderLines;
      try {
        orderLines = await this.executeKw('pos.order.line', 'search_read', [
          [['order_id.date_order', '>=', dateStr], ['order_id.state', 'in', ['paid', 'done', 'invoiced']]],
        ], {
          fields: ['product_id', 'qty'],
        });
      } catch (posError) {
        // Si POS falla, intentar con Sale Orders
        console.log('POS module not found, trying Sale Orders...');
        orderLines = await this.executeKw('sale.order.line', 'search_read', [
          [['order_id.date_order', '>=', dateStr], ['order_id.state', 'in', ['sale', 'done']]],
        ], {
          fields: ['product_id', 'product_uom_qty'],
        });
      }

      if (!orderLines || orderLines.length === 0) {
        console.log('No order lines found');
        return [];
      }

      // Agrupar por producto
      const productSales: { [key: number]: { id: number; name: string; totalQty: number } } = {};

      for (const line of orderLines) {
        const productId = line.product_id[0];
        const productName = line.product_id[1];
        // Usar 'qty' para POS o 'product_uom_qty' para Sales
        const quantity = line.qty || line.product_uom_qty || 0;

        if (!productSales[productId]) {
          productSales[productId] = {
            id: productId,
            name: productName,
            totalQty: 0,
          };
        }
        productSales[productId].totalQty += quantity;
      }

      // Ordenar y limitar
      return Object.values(productSales)
        .sort((a, b) => b.totalQty - a.totalQty)
        .slice(0, limit);
    } catch (error: any) {
      console.error('Error getting top selling products:', error?.message || error);
      // Retornar array vacío si hay error
      return [];
    }
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

export type { OdooProduct, OdooSaleOrder, OdooPurchaseOrder, OdooProductLot };
