import { Resend } from "resend";
import { env } from "../env";

/**
 * One plain template for every event: the title and body are already written in the
 * citizen's language of service at the call site, so a per-event React Email component
 * would only re-say the same thing in more files.
 *
 * ponytail: hand-rolled HTML, not react-email. Swap in a component library the day a
 * designer wants to own these — `sendEmail` is the only thing that would change.
 */

export function emailEnabled(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export function absoluteUrl(path: string): string {
  const base = env.APP_URL ?? env.BETTER_AUTH_URL;
  return new URL(path, base).toString();
}

function render({ title, body, link }: { title: string; body: string; link?: string }) {
  const url = link ? absoluteUrl(link) : null;
  return `<!doctype html>
<html><body style="margin:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#14161f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;padding:32px">
        <tr><td style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Constituency Connect</td></tr>
        <tr><td style="padding-top:12px;font-size:20px;font-weight:600">${escapeHtml(title)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#374151">${escapeHtml(body)}</td></tr>
        ${
          url
            ? `<tr><td style="padding-top:24px"><a href="${url}" style="display:inline-block;background:#3F51E0;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:15px;font-weight:500">View the details</a></td></tr>`
            : ""
        }
        <tr><td style="padding-top:28px;font-size:12px;color:#9ca3af">
          You are getting this because you use Constituency Connect. Turn these emails off in Settings.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendEmail(
  to: string,
  notice: { title: string; body: string; link?: string | null },
): Promise<void> {
  if (!emailEnabled()) return;
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM!,
    to,
    subject: notice.title,
    html: render({ title: notice.title, body: notice.body, link: notice.link ?? undefined }),
    text: `${notice.title}\n\n${notice.body}${notice.link ? `\n\n${absoluteUrl(notice.link)}` : ""}`,
  });
  if (error) throw new Error(error.message);
}
