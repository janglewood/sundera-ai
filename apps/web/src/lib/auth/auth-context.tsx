"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { identifyUser, resetUser } from "@/lib/analytics/posthog";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  // Tracks the previously-seen uid so we can tell a real sign-out (uid -> null)
  // apart from the initial anonymous state (null from the start). Calling
  // resetUser() on that initial state would discard the PostHog anon
  // distinct_id that already captured pre-signup events (photo_uploaded,
  // paywall_viewed, etc.), orphaning them from the identified person created
  // moments later — this was fragmenting one real user across many ids.
  const previousUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (nextUser) {
        identifyUser(nextUser.uid, { email: nextUser.email });
      } else if (previousUidRef.current) {
        resetUser();
      }
      previousUidRef.current = nextUser?.uid ?? null;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
