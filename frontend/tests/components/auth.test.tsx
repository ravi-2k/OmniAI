import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import type * as FirebaseModule from "@/services/auth/firebase";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { conversationsApi } from "@/services/api/endpoints";
import LoginPage from "@/pages/LoginPage";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { makeClient } from "../render";
import { server } from "../server";
import { API } from "../fixtures";

// Google's popup can't run in tests; everything after it (the backend exchange) is real.
const signInWithGoogle = vi.fn();
vi.mock("@/services/auth/firebase", async (importOriginal) => ({
  ...(await importOriginal<typeof FirebaseModule>()),
  signInWithGoogle: () => signInWithGoogle(),
}));

const { SignInError } = await import("@/services/auth/firebase");

const unauthorized = () =>
  HttpResponse.json({ success: false, code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

const session = (name = "Ada") =>
  HttpResponse.json({ user: { userId: "u1", name, email: "ada@x.com" } });

function SignOutButton() {
  const { signOut, user } = useAuth();
  return (
    <>
      <p>Hello {user?.name}</p>
      <button onClick={() => void signOut()}>Sign out</button>
    </>
  );
}

function renderAuth(route = "/") {
  const client = makeClient();
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route index element={<SignOutButton />} />
                <Route path="c/:id" element={<p>A private chat</p>} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return client;
}

describe("session restoration and protected routes", () => {
  it("restores a signed-in user after a refresh", async () => {
    server.use(http.get(`${API}/api/user`, () => session("Ada")));
    renderAuth();
    expect(await screen.findByText("Hello Ada")).toBeInTheDocument();
  });

  it("sends signed-out visitors to the login page", async () => {
    server.use(http.get(`${API}/api/user`, unauthorized));
    renderAuth("/c/123");
    expect(await screen.findByRole("button", { name: /Continue with Google/i })).toBeInTheDocument();
    expect(screen.queryByText("A private chat")).not.toBeInTheDocument();
  });

  it("returns to the page they asked for after signing in", async () => {
    server.use(
      http.get(`${API}/api/user`, unauthorized),
      http.post(`${API}/api/auth/login`, () => HttpResponse.json({ _id: "u1", name: "Ada" })),
    );
    signInWithGoogle.mockResolvedValueOnce("firebase-id-token");
    renderAuth("/c/123");

    await userEvent.click(await screen.findByRole("button", { name: /Continue with Google/i }));
    expect(await screen.findByText("A private chat")).toBeInTheDocument();
  });
});

describe("login", () => {
  it("exchanges the Firebase token with the backend", async () => {
    let sent: unknown;
    server.use(
      http.get(`${API}/api/user`, unauthorized),
      http.post(`${API}/api/auth/login`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ _id: "u1", name: "Ada" });
      }),
    );
    signInWithGoogle.mockResolvedValueOnce("firebase-id-token");
    renderAuth("/login");

    await userEvent.click(await screen.findByRole("button", { name: /Continue with Google/i }));
    await screen.findByText("Hello Ada");
    expect(sent).toEqual({ token: "firebase-id-token" });
  });

  it("explains a rejected sign-in", async () => {
    server.use(
      http.get(`${API}/api/user`, unauthorized),
      http.post(`${API}/api/auth/login`, () =>
        HttpResponse.json({ success: false, code: "INVALID_TOKEN", message: "bad" }, { status: 401 }),
      ),
    );
    signInWithGoogle.mockResolvedValueOnce("stale-token");
    renderAuth("/login");

    await userEvent.click(await screen.findByRole("button", { name: /Continue with Google/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in failed");
    expect(screen.getByRole("button", { name: /Continue with Google/i })).toBeEnabled();
  });

  it("shows a helpful message when the popup is blocked", async () => {
    server.use(http.get(`${API}/api/user`, unauthorized));
    signInWithGoogle.mockRejectedValueOnce(new SignInError("popup-blocked", "Your browser blocked the sign-in window."));
    renderAuth("/login");

    await userEvent.click(await screen.findByRole("button", { name: /Continue with Google/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("blocked the sign-in window");
  });

  it("treats closing the popup as a choice, not an error", async () => {
    server.use(http.get(`${API}/api/user`, unauthorized));
    signInWithGoogle.mockRejectedValueOnce(new SignInError("cancelled", "Sign-in was cancelled."));
    renderAuth("/login");

    await userEvent.click(await screen.findByRole("button", { name: /Continue with Google/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Continue with Google/i })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports a network failure during the exchange", async () => {
    server.use(http.get(`${API}/api/user`, unauthorized), http.post(`${API}/api/auth/login`, () => HttpResponse.error()));
    signInWithGoogle.mockResolvedValueOnce("tok");
    renderAuth("/login");

    await userEvent.click(await screen.findByRole("button", { name: /Continue with Google/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Can't reach the server/);
  });
});

describe("leaving the session", () => {
  it("signs out, clears cached data and returns to the login page", async () => {
    server.use(
      http.get(`${API}/api/user`, () => session()),
      http.post(`${API}/api/auth/logout`, () => HttpResponse.json({ message: "Logout Successful" })),
    );
    const client = renderAuth();
    await screen.findByText("Hello Ada");
    client.setQueryData(["conversations", ""], [{ secret: "previous user's chats" }]);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("button", { name: /Continue with Google/i })).toBeInTheDocument();
    expect(client.getQueryData(["conversations", ""])).toBeUndefined();
  });

  it("returns to login with a notice when the session expires mid-use", async () => {
    server.use(
      http.get(`${API}/api/user`, () => session()),
      http.get(`${API}/api/chat/get-conversation`, () =>
        HttpResponse.json({ success: false, code: "SESSION_EXPIRED", message: "Session expired" }, { status: 401 }),
      ),
    );
    const client = renderAuth();
    await screen.findByText("Hello Ada");
    client.setQueryData(["conversations", ""], [{ secret: "x" }]);

    await act(async () => {
      await conversationsApi.list({}).catch(() => undefined);
    });

    expect(await screen.findByText(/Your session ended/)).toBeInTheDocument();
    expect(client.getQueryData(["conversations", ""])).toBeUndefined();
  });
});
