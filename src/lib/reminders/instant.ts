import { after } from "next/server";

// Optional instant path for the confirmation mail (tools/reminders/README.md, "Mail de confirmación"):
// the Apps Script deployed as a web app runs its confirmations pass when it gets {token, action:
// "confirm"}. Only on the server, only when both variables exist (never NEXT_PUBLIC_). Without them,
// the hourly run of the script sends the confirmation.

export interface ConfirmRequest {
  url: string;
  init: RequestInit;
}

/** The request to the web app, or null when the instant path is not set up. */
export function confirmRequest(env: Record<string, string | undefined> = process.env): ConfirmRequest | null {
  const url = env.AVISOS_WEBAPP_URL?.trim();
  const token = env.AVISOS_WEBAPP_TOKEN?.trim();
  // The token only ever goes to Google's script host.
  if (!url || !token || !url.startsWith("https://script.google.com/")) return null;
  return {
    url,
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, action: "confirm" }),
      // The script answers with a redirect to the result: the work is already done, no need to follow it.
      redirect: "manual",
      cache: "no-store",
    },
  };
}

export function instantConfirmations(): boolean {
  return confirmRequest() !== null;
}

/**
 * Asks the script to send the pending confirmations now, after the response (never blocks nor fails
 * the save). The script keeps running even if this gives up waiting.
 */
export function requestConfirmations(): void {
  const req = confirmRequest();
  if (!req) return;
  after(async () => {
    try {
      await fetch(req.url, { ...req.init, signal: AbortSignal.timeout(8000) });
    } catch {
      // The hourly run sends it anyway.
    }
  });
}
