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

// Single "continue" flow: create the account if it doesn't exist yet, or
// sign in if it does. Tries create() first rather than signIn() first
// because Firebase's email-enumeration protection can make a nonexistent
// account and a wrong password return the same auth/invalid-credential code
// on sign-in, while auth/email-already-in-use from create() is unambiguous.
export async function continueWithEmail(email: string, password: string) {
  try {
    return await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      email,
      password,
    );
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "auth/email-already-in-use"
    ) {
      return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    }
    throw err;
  }
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
