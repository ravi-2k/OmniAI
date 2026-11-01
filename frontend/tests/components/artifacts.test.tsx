import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ArtifactPanel from "@/components/artifacts/ArtifactPanel";
import { FileTabs } from "@/components/artifacts/FileTabs";
import { renderApp } from "../render";
import { htmlArtifact } from "../fixtures";

const user = () => userEvent.setup({ pointerEventsCheck: 0 });

function TabsHarness() {
  const [active, setActive] = useState(0);
  return <FileTabs files={htmlArtifact().files} active={active} onSelect={setActive} panelId="p" />;
}

describe("file tabs", () => {
  it("shows one tab per file with the active one selected", () => {
    renderApp(<TabsHarness />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["index.html", "style.css", "script.js"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
  });

  it("switches by click and by keyboard (with wrap-around)", async () => {
    renderApp(<TabsHarness />);
    const u = user();

    await u.click(screen.getByRole("tab", { name: "style.css" }));
    expect(screen.getByRole("tab", { name: "style.css" })).toHaveAttribute("aria-selected", "true");

    await u.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "script.js" })).toHaveAttribute("aria-selected", "true");
    await u.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "index.html" })).toHaveAttribute("aria-selected", "true");
    await u.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "script.js" })).toHaveAttribute("aria-selected", "true");
    await u.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "index.html" })).toHaveAttribute("aria-selected", "true");
  });

  it("truncates long names but keeps the full path available", () => {
    renderApp(
      <FileTabs
        files={[{ name: "src/components/a-really-long-component-name.tsx", content: "" }]}
        active={0}
        onSelect={() => undefined}
        panelId="p"
      />,
    );
    const tab = screen.getByRole("tab");
    expect(tab).toHaveTextContent("a-really-long-component-name.tsx");
    expect(tab).toHaveAttribute("title", "src/components/a-really-long-component-name.tsx");
  });
});

describe("artifact panel", () => {
  it("shows Preview and Code tabs for an HTML project, previewing first", async () => {
    renderApp(<ArtifactPanel artifact={htmlArtifact()} onClose={() => undefined} />);

    expect(screen.getByText("Landing page")).toBeInTheDocument();
    expect(screen.getByText("3 files")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute("aria-selected", "true");

    const frame = screen.getByTitle(/Preview of Landing page/);
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(frame).not.toHaveAttribute("sandbox", expect.stringContaining("allow-same-origin"));
  });

  it("switches to the code view with file tabs, and back", async () => {
    renderApp(<ArtifactPanel artifact={htmlArtifact()} onClose={() => undefined} />);
    const u = user();

    await u.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.getByRole("tablist", { name: "Project files" })).toBeInTheDocument();
    expect(screen.queryByTitle(/Preview of/)).not.toBeInTheDocument();

    await u.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByTitle(/Preview of Landing page/)).toBeInTheDocument();
  });

  it("copies the current file", async () => {
    renderApp(<ArtifactPanel artifact={htmlArtifact()} onClose={() => undefined} />);
    const u = user();

    await u.click(screen.getByRole("tab", { name: "Code" }));
    await u.click(screen.getByRole("tab", { name: "style.css" }));
    await u.click(screen.getByRole("button", { name: "Copy file" }));

    expect(await navigator.clipboard.readText()).toBe("h1{color:red}");
  });

  it("has no Preview tab for non-web projects", () => {
    renderApp(
      <ArtifactPanel
        artifact={{ id: 2, type: "Project", title: "Script", files: [{ name: "main.py", content: "print(1)", language: "python" }] }}
        onClose={() => undefined}
      />,
    );
    expect(screen.queryByRole("tab", { name: "Preview" })).not.toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Project files" })).toBeInTheDocument();
  });

  it("closes", async () => {
    const onClose = vi.fn();
    renderApp(<ArtifactPanel artifact={htmlArtifact()} onClose={onClose} />);
    await user().click(screen.getByRole("button", { name: "Close panel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
