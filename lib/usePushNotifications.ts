'use client';

import { useEffect, useState, useCallback } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  const needsIOSInstall = isIOS() && !isStandalone();

  useEffect(() => {
    if (!isSupported) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || needsIOSInstall) return;

    setLoading(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return;

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error('Falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY');
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo activar las notificaciones');
    } finally {
      setLoading(false);
    }
  }, [isSupported, needsIOSInstall]);

  return { permission, isSupported, needsIOSInstall, loading, error, subscribe };
}
