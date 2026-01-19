import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getOdooClient } from '@/lib/odoo';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const odoo = getOdooClient();

    let products;
    let total = 0;

    if (query) {
      products = await odoo.searchProducts(query, limit, offset);
      // Para búsqueda, necesitamos contar el total de resultados
      const allResults = await odoo.searchProducts(query, 1000); // Obtener todos para contar
      total = allResults.length;
    } else if (category) {
      products = await odoo.getProductsByCategory(category);
      total = products.length;
    } else {
      products = await odoo.getProducts([], limit, offset);
      // Para obtener el total, podemos hacer una búsqueda sin límite
      const allProducts = await odoo.getProducts([], 1000);
      total = allProducts.length;
    }

    return NextResponse.json({ 
      products,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (error: any) {
    console.error('Products API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
