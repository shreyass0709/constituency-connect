import { createSign } from "node:crypto";
import { env } from "../env";
import { absoluteUrl } from "./email";

/**
 * FCM web push over the HTTP v1 API.
 *
 * ponytail: no `firebase-admin`. All the SDK would do here is mint an OAuth token from
 * the service account and POST JSON — that is the twenty lines below, minus a dependency
 * that drags in the whole Google auth stack for one call.
 */

export function pushEnabled(): boolean {
  return Boolean(env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY);
}

const base64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64url");

let cached: { token: string; expiresAt: number } | null = null;

/** Service-account JWT → OAuth access token, cached until a minute before it expires. */
async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = {
    iss: env.FCM_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  };
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(
    JSON.stringify(claims),
  )}`;
  const signer = createSign("RSA-SHA256").update(unsigned);
  // Env vars carry the PEM with literal "\n" sequences.
  const signature = signer.sign(env.FCM_PRIVATE_KEY!.replace(/\\n/g, "\n"));

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64url(signature)}`,
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`FCM auth failed: ${body.error_description ?? response.status}`);

  cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cached.token;
}

/**
 * Sends to every registered device and returns the tokens the service rejected as dead,
 * so the caller can drop them from the user's row.
 */
export async function sendPush(
  tokens: string[],
  notice: { title: string; body: string; link?: string | null },
): Promise<{ dead: string[] }> {
  if (!pushEnabled() || tokens.length === 0) return { dead: [] };

  const auth = await accessToken();
  const endpoint = `https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`;
  const dead: string[] = [];

  // One request per token: v1 has no multicast, and at this volume a loop is the whole
  // batching strategy we need.
  await Promise.all(
    tokens.map(async (token) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: notice.title, body: notice.body },
            webpush: {
              fcmOptions: { link: absoluteUrl(notice.link ?? "/dashboard") },
            },
          },
        }),
      });
      if (response.ok) return;
      // 404 UNREGISTERED / 400 INVALID_ARGUMENT on the token ⇒ the device is gone.
      if (response.status === 404 || response.status === 400) dead.push(token);
      else console.error("[push] send failed", response.status, await response.text());
    }),
  );

  return { dead };
}
