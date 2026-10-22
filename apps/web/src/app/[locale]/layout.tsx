import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthProvider } from "@/lib/auth/auth-context";
import { PaywallProvider } from "@/lib/paywall/paywall-context";
import { PostHogProvider } from "@/lib/analytics/PostHogProvider";
import { FeedbackWidget } from "@/components/shared/FeedbackWidget";
import { SITE_URL } from "@/lib/site";
import { inter, calistoga } from "@/lib/fonts";
import { routing } from "@/i18n/routing";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(
  props: LayoutProps<"/[locale]">,
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = l === routing.defaultLocale ? "/" : `/${l}`;
  }

  return {
    metadataBase: new URL(SITE_URL),
    title: t("siteTitle"),
    description: t("siteDescription"),
    alternates: { languages },
    other: {
      "p:domain_verify": "cb53bedef7cd255eef5b0d97cc4575c1",
    },
    verification: {
      google: "uQy2QmSj-Yso0gD9QMyVKxJHSATzTWgqF_arwON5WAM",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#faf6f1",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
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
        <NextIntlClientProvider>
          <PostHogProvider>
            <AuthProvider>
              <PaywallProvider>{children}</PaywallProvider>
              <FeedbackWidget />
            </AuthProvider>
          </PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
