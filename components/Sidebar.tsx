'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  ShoppingCart,
  LogOut,
  ClipboardList,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import OliviaLogo from './OliviaLogo';

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Restore collapsed state from localStorage
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  // Persist collapsed state
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('sidebar-collapsed', String(collapsed));
    }
  }, [collapsed, mounted]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const links = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      href: '/chat',
      label: 'Chat',
      icon: MessageSquare,
    },
    {
      href: '/orders',
      label: 'Pedidos Web',
      icon: ClipboardList,
    },
    {
      href: '/suggestions',
      label: 'Sugerencias',
      icon: ShoppingCart,
    },
  ];

  // Full sidebar content (used in mobile drawer and expanded desktop)
  const mobileSidebarContent = (
    <>
      {/* Logo */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <OliviaLogo size={40} className="text-primary-500" />
          <h1 className="text-xl font-bold text-gray-900">OlivIA</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User info & Logout */}
      <div className="p-4 border-t border-gray-200">
        {session?.user && (
          <div className="flex items-center gap-3 px-2 mb-3">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || ''}
                className="w-9 h-9 rounded-full flex-shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-primary-700">
                  {session.user.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {session.user.email}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors w-full"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </>
  );

  if (!mounted) {
    return (
      <>
        {/* Mobile header placeholder */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 h-14" />
        {/* Desktop sidebar placeholder */}
        <div className="hidden md:flex w-64 bg-white h-screen flex-col">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <OliviaLogo size={40} className="text-primary-500" />
              <h1 className="text-xl font-bold text-gray-900">OlivIA</h1>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <OliviaLogo size={28} className="text-primary-500" />
            <h1 className="text-lg font-bold text-gray-900">OlivIA</h1>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed top-14 right-0 bottom-0 z-30 w-64 bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {mobileSidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div
        className={`hidden md:flex bg-white h-screen flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${
          collapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        {/* Header: logo + collapse toggle */}
        <div className="flex items-center justify-between p-4">
          <div className={`flex items-center gap-3 min-w-0 ${collapsed ? 'justify-center w-full' : ''}`}>
            <OliviaLogo size={collapsed ? 32 : 40} className="text-primary-500 flex-shrink-0" />
            {!collapsed && (
              <h1 className="text-xl font-bold text-gray-900 whitespace-nowrap">OlivIA</h1>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
              title="Colapsar sidebar"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <div className="px-2 mb-1">
            <button
              onClick={() => setCollapsed(false)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors w-full flex justify-center"
              title="Expandir sidebar"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className={`flex-1 ${collapsed ? 'px-2 py-4' : 'p-4'}`}>
          <ul className="space-y-2">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/');

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    title={collapsed ? link.label : undefined}
                    className={`flex items-center gap-3 rounded-lg transition-colors ${
                      collapsed ? 'px-0 py-3 justify-center' : 'px-4 py-3'
                    } ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span>{link.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User info & Logout */}
        <div className={`border-t border-gray-200 ${collapsed ? 'p-2' : 'p-4'}`}>
          {session?.user && (
            <div className={`flex items-center mb-3 ${collapsed ? 'justify-center' : 'gap-3 px-2'}`}>
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || ''}
                  className={`rounded-full flex-shrink-0 ${collapsed ? 'w-8 h-8' : 'w-9 h-9'}`}
                  referrerPolicy="no-referrer"
                  title={collapsed ? `${session.user.name}\n${session.user.email}` : undefined}
                />
              ) : (
                <div
                  className={`rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 ${collapsed ? 'w-8 h-8' : 'w-9 h-9'}`}
                  title={collapsed ? `${session.user.name}\n${session.user.email}` : undefined}
                >
                  <span className="text-sm font-semibold text-primary-700">
                    {session.user.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {session.user.email}
                  </p>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title={collapsed ? 'Cerrar Sesión' : undefined}
            className={`flex items-center gap-3 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors w-full ${
              collapsed ? 'px-0 py-3 justify-center' : 'px-4 py-3'
            }`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </div>
    </>
  );
}
