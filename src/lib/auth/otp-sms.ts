/**
 * Pluggable OTP sender. `SMS_PROVIDER=console` (the default) logs the code to the server
 * console, which is what dev and a closed pilot run on. `SMS_PROVIDER=msg91` sends it for
 * real — that needs a DLT-approved template, which is a registration task, not a code one.
 */
export async function sendOtpSms(phone: string, code: string): Promise<void> {
  if (process.env.SMS_PROVIDER !== "msg91") {
    console.log(`[OTP] ${phone} → ${code}`);
    return;
  }

  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  if (!authKey || !templateId) {
    throw new Error("SMS_PROVIDER=msg91 needs MSG91_AUTH_KEY and MSG91_TEMPLATE_ID");
  }

  // MSG91 wants the number without a leading + and with the country code attached.
  const response = await fetch("https://control.msg91.com/api/v5/otp", {
    method: "POST",
    headers: { authkey: authKey, "content-type": "application/json" },
    body: JSON.stringify({
      template_id: templateId,
      mobile: phone.replace(/[^0-9]/g, ""),
      otp: code,
      // Better Auth owns expiry and verification; MSG91 is only the delivery pipe.
      otp_expiry: 10,
    }),
  });

  const body = (await response.json().catch(() => null)) as { type?: string; message?: string } | null;

  // MSG91 answers 200 with {"type":"error"} on a rejected template, so the status alone
  // is not the check — a silently undelivered OTP looks exactly like a working login.
  if (!response.ok || body?.type !== "success") {
    throw new Error(`MSG91 refused the OTP: ${body?.message ?? response.status}`);
  }
}
