import { describe, expect, test } from "vitest";
import type { UserMessageAuthor } from "@getpaseo/protocol/user-message-author";
import type { SessionOutboundMessage } from "./messages.js";
import { withUserAvatars } from "./user-identity.js";

const AVATAR_TEMPLATE = "https://images.example.com/{username}.png";

type FetchWorkspacesMessage = Extract<
  SessionOutboundMessage,
  { type: "fetch_workspaces_response" }
>;
type WorkspaceUpdateMessage = Extract<SessionOutboundMessage, { type: "workspace_update" }>;

function workspace(participants?: UserMessageAuthor[]) {
  return {
    id: "workspace-1",
    projectId: "project-1",
    projectDisplayName: "project",
    projectRootPath: "/repo",
    workspaceDirectory: "/repo",
    projectKind: "git" as const,
    workspaceKind: "checkout" as const,
    name: "main",
    title: null,
    pinnedAt: null,
    labels: [],
    status: "done" as const,
    statusEnteredAt: null,
    createdAt: "2026-11-10T10:00:00.000Z",
    lastUserMessageAt: null,
    activityAt: null,
    archivingAt: null,
    diffStat: null,
    scripts: [],
    gitRuntime: null,
    githubRuntime: null,
    ...(participants ? { participants } : {}),
  };
}

function fetchWorkspaces(participants?: UserMessageAuthor[]): FetchWorkspacesMessage {
  return {
    type: "fetch_workspaces_response",
    payload: {
      requestId: "request-1",
      entries: [workspace(participants)],
      emptyProjects: [],
      pageInfo: { nextCursor: null, prevCursor: null, hasMore: false },
    },
  };
}

function workspaceUpsert(participants?: UserMessageAuthor[]): WorkspaceUpdateMessage {
  return {
    type: "workspace_update",
    payload: { kind: "upsert", workspace: workspace(participants) },
  };
}

function participantsOf(message: SessionOutboundMessage, template: string | undefined) {
  const decorated = withUserAvatars(message, template);
  if (decorated.type === "fetch_workspaces_response") {
    return decorated.payload.entries[0]?.participants;
  }
  if (decorated.type === "workspace_update" && decorated.payload.kind === "upsert") {
    return decorated.payload.workspace.participants;
  }
  throw new Error(`Unexpected message type: ${decorated.type}`);
}

describe("withUserAvatars", () => {
  test("resolves participant avatars in a workspace list", () => {
    expect(
      participantsOf(
        fetchWorkspaces([{ username: "panta" }, { username: "ivana.j" }]),
        AVATAR_TEMPLATE,
      ),
    ).toEqual([
      { username: "panta", avatarUrl: "https://images.example.com/panta.png" },
      { username: "ivana.j", avatarUrl: "https://images.example.com/ivana.j.png" },
    ]);
  });

  test("resolves participant avatars on a single workspace update", () => {
    expect(participantsOf(workspaceUpsert([{ username: "panta" }]), AVATAR_TEMPLATE)).toEqual([
      { username: "panta", avatarUrl: "https://images.example.com/panta.png" },
    ]);
  });

  test("leaves usernames alone when the host has no avatar template", () => {
    expect(participantsOf(workspaceUpsert([{ username: "panta" }]), undefined)).toEqual([
      { username: "panta" },
    ]);
  });

  test("keeps a workspace without participants unchanged", () => {
    expect(participantsOf(workspaceUpsert(), AVATAR_TEMPLATE)).toBeUndefined();
  });
});
