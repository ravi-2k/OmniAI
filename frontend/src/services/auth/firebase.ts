import { initializeApp, type FirebaseApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from "firebase/auth";

import { env, missingFirebaseConfig } from "@/config/env";

export class SignInError extends Error {
  readonly kind: "cancelled" | "popup-blocked" | "network" | "unauthorized-domain" | "config" | "unknown";

  constructor(kind: SignInError["kind"], message: string) {
    super(message);
    this.name = "SignInError";
    this.kind = kind;
  }
}

let app: FirebaseApp | null = null;

const getFirebaseApp = () => {
  if (missingFirebaseConfig().length) {
    throw new SignInError("config", "Sign-in isn't configured for this environment.");
  }
  app ??= initializeApp(env.firebase);
  return app;
};

/**
 * Opens the Google popup and returns a Firebase ID token for the backend to verify.
 * The backend owns the session (httpOnly cookie), so the client-side Firebase
 * session is cleared immediately: there is exactly one source of truth.
 */
export const signInWithGoogle = async (): Promise<string> => {
  const auth = getAuth(getFirebaseApp());

  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    const token = await result.user.getIdToken();
    await signOut(auth);
    return token;
  } catch (error) {
    if (error instanceof SignInError) throw error;
    const code = (error as { code?: string }).code ?? "";
    switch (code) {
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        throw new SignInError("cancelled", "Sign-in was cancelled.");
      case "auth/popup-blocked":
        throw new SignInError(
          "popup-blocked",
          "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
        );
      case "auth/network-request-failed":
        throw new SignInError("network", "Network error. Check your connection and try again.");
      case "auth/unauthorized-domain":
        throw new SignInError(
          "unauthorized-domain",
          "This domain isn't authorised for sign-in. Add it in the Firebase console.",
        );
      default:
        throw new SignInError("unknown", "We couldn't sign you in. Please try again.");
    }
  }
};
