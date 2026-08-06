import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber } from "better-auth/plugins";
import { db } from "../db"; // relative (not @/lib/db) so the better-auth CLI's loader resolves it
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
        await sendOtpSms(phoneNumber, code);
      },
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
