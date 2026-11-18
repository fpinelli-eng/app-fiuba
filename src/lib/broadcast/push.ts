import webpush from "web-push";
import { isGoneStatus } from "./model";

// Sending web push from the server with the `web-push` package. The keys are environment variables
// (never in the repository): `npx web-push generate-vapid-keys` makes a pair.
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  the public key (also used by the browser to subscribe)
//   VAPID_PRIVATE_KEY             the private key, only on the server
//   VAPID_SUBJECT                 a contact, "mailto:…" or "https://…"
// Without the three, nothing is sent and the screens say so.

export function vapidConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendResult {
  sent: number;
  failed: number;
  /** Endpoints the push service says are gone (404/410): the caller deletes them. */
  gone: string[];
}

const BATCH = 50;

export async function sendPush(targets: PushTarget[], payload: string): Promise<SendResult> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) throw new Error("VAPID keys missing");
  const options = { vapidDetails: { subject, publicKey, privateKey }, TTL: 60 * 60 * 24, urgency: "normal" as const };

  const result: SendResult = { sent: 0, failed: 0, gone: [] };
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map((t) => webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, options)),
    );
    settled.forEach((s, j) => {
      if (s.status === "fulfilled") {
        result.sent++;
        return;
      }
      const status = (s.reason as { statusCode?: number } | null)?.statusCode;
      if (isGoneStatus(status)) result.gone.push(batch[j].endpoint);
      else result.failed++;
    });
  }
  // Only counts in the log: never endpoints (they identify a browser) nor who received it.
  if (result.failed) console.error(`push: ${result.failed} failed of ${targets.length}`);
  return result;
}
