import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { ConversationList } from "@/components/sidebar/ConversationList";
import { renderApp } from "../render";
import { server } from "../server";
import { API, conversation } from "../fixtures";

const user = () => userEvent.setup({ pointerEventsCheck: 0 });
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const list = (items: ReturnType<typeof conversation>[]) =>
  server.use(http.get(`${API}/api/chat/get-conversation`, () => HttpResponse.json(items)));

describe("conversation list", () => {
  it("groups chats by recency using their real timestamps", async () => {
    list([
      conversation({ _id: "a", title: "Today chat", updatedAt: new Date().toISOString() }),
      conversation({ _id: "b", title: "Last week chat", updatedAt: daysAgo(4) }),
      conversation({ _id: "c", title: "Ancient chat", updatedAt: daysAgo(60) }),
    ]);
    renderApp(<ConversationList search="" />);

    expect(await screen.findByText("Today chat")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Previous 7 days" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Older" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Yesterday" })).not.toBeInTheDocument();
  });

  it("marks the open chat and links to it", async () => {
    list([conversation({ _id: "a", title: "First" }), conversation({ _id: "b", title: "Second" })]);
    renderApp(<ConversationList search="" activeId="b" />);

    const active = await screen.findByRole("link", { name: "Second" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("href", "/c/b");
    expect(screen.getByRole("link", { name: "First" })).not.toHaveAttribute("aria-current");
  });

  it("shows a welcoming empty state", async () => {
    list([]);
    renderApp(<ConversationList search="" />);
    expect(await screen.findByText("No chats yet")).toBeInTheDocument();
  });

  it("searches on the server and explains an empty result", async () => {
    let query: string | null = null;
    server.use(
      http.get(`${API}/api/chat/get-conversation`, ({ request }) => {
        query = new URL(request.url).searchParams.get("q");
        return HttpResponse.json([]);
      }),
    );
    renderApp(<ConversationList search="invoice" />);

    expect(await screen.findByText("No matching chats")).toBeInTheDocument();
    expect(query).toBe("invoice");
  });

  it("offers a retry when loading fails", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/api/chat/get-conversation`, () => {
        calls++;
        return calls === 1
          ? HttpResponse.json({ success: false, code: "SERVER_ERROR", message: "x" }, { status: 500 })
          : HttpResponse.json([conversation({ title: "Recovered" })]);
      }),
    );
    renderApp(<ConversationList search="" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/went wrong/i);
    await user().click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Recovered")).toBeInTheDocument();
  });
});

describe("renaming and deleting", () => {
  it("renames a chat inline", async () => {
    list([conversation({ _id: "a", title: "Old name" })]);
    let body: unknown;
    server.use(
      http.post(`${API}/api/chat/update-conversation`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(conversation({ _id: "a", title: "Better name" }));
      }),
    );
    renderApp(<ConversationList search="" />);
    const u = user();

    await screen.findByText("Old name");
    await u.click(screen.getByRole("button", { name: "Options for Old name" }));
    await u.click(await screen.findByRole("menuitem", { name: /Rename/ }));

    const input = await screen.findByRole("textbox", { name: "Chat title" });
    await u.clear(input);
    await u.type(input, "Better name{Enter}");

    await waitFor(() => expect(body).toEqual({ id: "a", title: "Better name" }));
  });

  it("cancels a rename with Escape", async () => {
    list([conversation({ _id: "a", title: "Keep me" })]);
    let called = false;
    server.use(http.post(`${API}/api/chat/update-conversation`, () => ((called = true), HttpResponse.json({}))));
    renderApp(<ConversationList search="" />);
    const u = user();

    await screen.findByText("Keep me");
    await u.click(screen.getByRole("button", { name: "Options for Keep me" }));
    await u.click(await screen.findByRole("menuitem", { name: /Rename/ }));
    await u.keyboard("{Escape}");

    expect(called).toBe(false);
    expect(await screen.findByText("Keep me")).toBeInTheDocument();
  });

  it("asks for confirmation before deleting, then removes the chat", async () => {
    let remaining = [conversation({ _id: "a", title: "Doomed" }), conversation({ _id: "b", title: "Survivor" })];
    server.use(
      http.get(`${API}/api/chat/get-conversation`, () => HttpResponse.json(remaining)),
      http.delete(`${API}/api/chat/delete-conversation/a`, () => {
        remaining = remaining.filter((item) => item._id !== "a");
        return HttpResponse.json({ message: "Conversation deleted" });
      }),
    );
    renderApp(<ConversationList search="" />);
    const u = user();

    await screen.findByText("Doomed");
    await u.click(screen.getByRole("button", { name: "Options for Doomed" }));
    await u.click(await screen.findByRole("menuitem", { name: /Delete/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Delete this chat?")).toBeInTheDocument();
    // Cancel leaves everything alone.
    await u.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(remaining).toHaveLength(2);

    await u.click(screen.getByRole("button", { name: "Options for Doomed" }));
    await u.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByText("Doomed")).not.toBeInTheDocument());
    expect(screen.getByText("Survivor")).toBeInTheDocument();
  });

  it("reports a failed delete and keeps the chat", async () => {
    list([conversation({ _id: "a", title: "Stubborn" })]);
    server.use(
      http.delete(`${API}/api/chat/delete-conversation/a`, () =>
        HttpResponse.json({ success: false, code: "SERVER_ERROR", message: "x" }, { status: 500 }),
      ),
    );
    renderApp(<ConversationList search="" />);
    const u = user();

    await screen.findByText("Stubborn");
    await u.click(screen.getByRole("button", { name: "Options for Stubborn" }));
    await u.click(await screen.findByRole("menuitem", { name: /Delete/ }));
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Couldn't delete chat")).toBeInTheDocument();
    expect(screen.getByText("Stubborn")).toBeInTheDocument();
  });
});
