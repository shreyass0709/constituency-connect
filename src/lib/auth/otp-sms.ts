// Pluggable OTP SMS sender. Dev logs to console; prod swaps in MSG91 behind this
// same function once DLT templates are approved (a business task, not a code one).
export async function sendOtpSms(phone: string, code: string): Promise<void> {
  if (process.env.SMS_PROVIDER === "msg91") {
    // ponytail: wire MSG91 here when DLT is ready — same signature, no callers change.
    throw new Error("SMS_PROVIDER=msg91 but MSG91 is not configured yet");
  }
  console.log(`[OTP] ${phone} → ${code}`);
}
