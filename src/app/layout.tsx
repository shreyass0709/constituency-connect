import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ variable: "--font-sans-var", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-heading-var", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Constituency Connect", template: "%s · Constituency Connect" },
  description: "Raise civic issues, track them, and see what gets fixed.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          {children}
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
