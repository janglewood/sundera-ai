import type { Metadata, Viewport } from "next";
import { Calistoga, Inter } from "next/font/google";
import Script from "next/script";
import { AuthProvider } from "@/lib/auth/auth-context";
import { PaywallProvider } from "@/lib/paywall/paywall-context";
import { PostHogProvider } from "@/lib/analytics/PostHogProvider";
import { FeedbackWidget } from "@/components/shared/FeedbackWidget";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const calistoga = Calistoga({
  variable: "--font-calistoga",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sundera — AI Interior Design From One Photo",
  description:
    "Try AI interior design free: upload a room photo, pick a style, and get a photorealistic redesign in seconds.",
  other: {
    "p:domain_verify": "cb53bedef7cd255eef5b0d97cc4575c1",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf6f1",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${calistoga.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=AW-18454618871"
        />
        <Script id="gtag-init">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-18454618871');
          `}
        </Script>
        <PostHogProvider>
          <AuthProvider>
            <PaywallProvider>{children}</PaywallProvider>
            <FeedbackWidget />
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
