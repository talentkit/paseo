/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserMessageAuthor } from "@getpaseo/protocol/user-message-author";
import { SidebarParticipantHeads } from "./sidebar-participant-heads";

// App sources compile against the classic JSX runtime, which expects React on the global.
beforeEach(() => vi.stubGlobal("React", React));

interface Mounted {
  root: Root;
  container: HTMLDivElement;
}

const mounted: Mounted[] = [];

afterEach(() => {
  for (const entry of mounted.splice(0)) {
    act(() => entry.root.unmount());
    entry.container.remove();
  }
});

function mountHeads(participants: UserMessageAuthor[]): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(<SidebarParticipantHeads participants={participants} backdrop="surfaceSidebar" />),
  );
  mounted.push({ root, container });
  return container;
}

function heads(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-testid^="sidebar-participant-head-"]'),
  );
}

describe("SidebarParticipantHeads", () => {
  it("shows nothing for a conversation nobody attributed", () => {
    expect(mountHeads([]).children).toHaveLength(0);
  });

  it("shows a single face, most recent first", () => {
    const container = mountHeads([{ username: "panta" }]);

    expect(heads(container).map((head) => head.getAttribute("aria-label"))).toEqual(["panta"]);
  });

  it("keeps three faces and drops the rest", () => {
    const container = mountHeads([
      { username: "panta" },
      { username: "ivana" },
      { username: "marko" },
      { username: "ana" },
    ]);

    expect(heads(container).map((head) => head.getAttribute("aria-label"))).toEqual([
      "panta",
      "ivana",
      "marko",
    ]);
  });

  it("falls back to initials when a person has no avatar image", () => {
    const container = mountHeads([{ username: "panta" }]);

    expect(heads(container)[0]?.textContent).toBe("P");
  });

  it("renders an avatar image when the host resolved one", () => {
    const container = mountHeads([
      { username: "panta", avatarUrl: "https://images.example.com/panta.png" },
    ]);

    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://images.example.com/panta.png",
    );
  });
});
