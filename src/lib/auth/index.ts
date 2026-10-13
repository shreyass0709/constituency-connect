import { APIError, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber } from "better-auth/plugins";
import { db } from "../db"; // relative (not @/lib/db) so the better-auth CLI's loader resolves it
import { rateLimit } from "../ratelimit";
import { sendOtpSms } from "./otp-sms";

// Phone-OTP is primary (citizens may lack email). Google OAuth is added later once
// Google Cloud creds exist. RBAC/role is our own User.role enum — read in requireUser,
// not managed by Better Auth's admin plugin.
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: false },
  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        // 3 per 10 minutes per phone (docs/02 §8). The IP limit on the route in front of
        // this stops one machine hammering; this stops one *number* being hammered from
        // many machines — which is the version that costs real money per SMS.
        if (process.env.DEMO_OTP) return; // demo sign-in: nothing is sent, nothing to meter
        const limit = await rateLimit(`otp:${phoneNumber}`, 3, 600_000);
        if (!limit.ok) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many codes requested. Please wait a few minutes and try again.",
          });
        }

        await sendOtpSms(phoneNumber, code);
      },
      // Demo sign-in (see DEMO_OTP in lib/env.ts): one fixed code instead of the texted one.
      verifyOTP: process.env.DEMO_OTP
        ? ({ code }) => code === process.env.DEMO_OTP
        : undefined,
      requireVerification: true,
      // Reuse the existing User.phone column instead of a second phoneNumber column.
      schema: {
        user: {
          fields: {
            phoneNumber: "phone",
            phoneNumberVerified: "phoneVerified",
          },
        },
      },
      // New phone → create a citizen with placeholder email/name (both editable at onboarding).
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone.replace(/[^0-9]/g, "")}@phone.local`,
        getTempName: (phone) => phone,
      },
    }),
    nextCookies(), // must stay last — lets server actions set the session cookie
  ],
});
