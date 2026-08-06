import webpush from 'web-push';
import connectDB from '@/lib/mongodb';
import PushSubscription from '@/models/PushSubscription';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || '';

if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/**
 * Manda `payload` a todas las subscriptions guardadas. Subscriptions que el
 * push service reporta como muertas (404/410 - desinstalada, permiso revocado)
 * se borran de Mongo en el momento; el resto de errores solo se loguean.
 */
export async function sendPushToAll(payload: PushPayload): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error('VAPID keys no configuradas, no se puede enviar push');
    return;
  }

  await connectDB();
  const subscriptions = await PushSubscription.find({});
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        body
      )
    )
  );

  const deadEndpoints: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const statusCode = result.reason?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        deadEndpoints.push(subscriptions[i].endpoint);
      } else {
        console.error('Error enviando push:', result.reason?.message || result.reason);
      }
    }
  });

  if (deadEndpoints.length > 0) {
    await PushSubscription.deleteMany({ endpoint: { $in: deadEndpoints } });
  }
}
