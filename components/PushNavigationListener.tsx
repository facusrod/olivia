'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * El Service Worker no navega la ventana directamente al clickear una
 * notificacion (WindowClient.navigate() tiene soporte muy erratico en
 * Safari/iOS) - en cambio manda un postMessage y esta pieza hace el
 * router.push() del lado del cliente, dentro de la SPA de Next.js.
 */
export default function PushNavigationListener() {
  const router = useRouter();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'olivia-navigate' && typeof event.data.url === 'string') {
        router.push(event.data.url);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [router]);

  return null;
}
