'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import OliviaLogo from '@/components/OliviaLogo';
import { ArrowUpRight, BarChart3, MessageSquare, Package, ShoppingCart } from 'lucide-react';

function LoginContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  if (!mounted) {
    return null;
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 px-4 py-10 sm:px-8">
      <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
        <section aria-labelledby="product-title">
          <div className="mb-6 flex items-center gap-3 text-primary-700">
            <OliviaLogo size={48} className="text-primary-500" />
            <span className="text-2xl font-bold">OlivIA</span>
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary-700">Inteligencia artificial para la gestión diaria</p>
          <h1 id="product-title" className="text-4xl font-bold leading-tight text-gray-900 sm:text-5xl">
            Conocé tu tienda.<br />Decidí con información.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-700">
            Olivia es un asistente inteligente conectado a Odoo, creado para acompañar el día a día de Greenhouse, una tienda de productos saludables. Reúne información de productos, inventario y ventas para ayudarte a gestionar el negocio.
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {[
              { icon: MessageSquare, title: 'Consultas en lenguaje natural', description: 'Preguntá por productos, opciones alimentarias, stock y ventas.' },
              { icon: Package, title: 'Inventario actualizado', description: 'Consultá existencias en Odoo y detectá productos con stock bajo.' },
              { icon: BarChart3, title: 'El negocio a la vista', description: 'Seguí las métricas de ventas y los productos próximos a vencer.' },
              { icon: ShoppingCart, title: 'Compras con más contexto', description: 'Recibí sugerencias de compra basadas en las ventas y el stock.' },
            ].map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-3">
                <Icon aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary-700" />
                <div>
                  <h2 className="font-semibold text-gray-900">{title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{description}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8 border-t border-green-200 pt-6">
            <p className="text-sm leading-relaxed text-gray-600">
              Un producto de <span className="font-semibold text-gray-900">Facundo Rodriguez</span>, desarrollador de software y creador de soluciones para negocios reales.
            </p>
            <a href="https://rodriguezfacundo.com/" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-700 px-5 py-3 font-semibold text-white transition-colors hover:bg-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-700">
              Conocé mis otros proyectos
              <ArrowUpRight aria-hidden="true" className="h-5 w-5" />
            </a>
            <p className="mt-3 text-sm text-gray-600">Contacto, experiencia profesional y CV en mi sitio web.</p>
          </div>
        </section>
      <section aria-labelledby="login-title" className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <OliviaLogo size={64} className="text-primary-500" />
          </div>
          <h2 id="login-title" className="text-2xl font-bold text-gray-900 mb-2">Ingresá a OlivIA</h2>
          <p className="text-gray-600">
            Accedé a las herramientas de gestión de tu tienda
          </p>
        </div>

        {error === 'AccessDenied' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-medium text-center">
              Tu cuenta no tiene acceso autorizado.
            </p>
            <p className="text-red-600 text-xs text-center mt-1">
              Contacta al administrador para solicitar acceso.
            </p>
          </div>
        )}

        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continuar con Google
        </button>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Sistema interno de gestión</p>
          <p className="mt-1">Solo para empleados autorizados</p>
        </div>
      </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
