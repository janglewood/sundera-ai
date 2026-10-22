"use client";

import { getAdditionalUserInfo, type UserCredential } from "firebase/auth";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { AuthForm } from "@/components/auth/AuthForm";
import { track } from "@/lib/analytics/posthog";

function LoginForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const destination =
    searchParams.get("next") === "paywall" ? "/app?openPaywall=1" : "/app";

  useEffect(() => {
    if (!loading && user) {
      router.replace(destination);
    }
  }, [loading, user, router, destination]);

  function handleSuccess(credential: UserCredential) {
    const isNewUser = getAdditionalUserInfo(credential)?.isNewUser ?? false;
    track(isNewUser ? "signed_up" : "signed_in", {
      method: credential.providerId ?? "password",
    });
    router.push(destination);
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <AuthForm
        title={t("signInTitle")}
        subtitle={t("signInSubtitle")}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
