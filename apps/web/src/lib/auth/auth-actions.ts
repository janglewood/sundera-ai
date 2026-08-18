import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase";

const ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
};

export function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    if (code in ERROR_MESSAGES) return ERROR_MESSAGES[code];
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export function signInWithGoogle() {
  return signInWithPopup(getFirebaseAuth(), googleProvider);
}

export function signOutUser() {
  return signOut(getFirebaseAuth());
}

export function resetPassword(email: string) {
  return sendPasswordResetEmail(getFirebaseAuth(), email);
}
