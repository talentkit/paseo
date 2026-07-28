import { describe, expect, it } from "vitest";
import type { WorkspaceSetupSnapshot } from "@/stores/workspace-setup-store";
import {
  resolveWorkspaceSetupAutoOpenMode,
  WORKSPACE_SETUP_AUTO_OPEN_WINDOW_MS,
} from "./workspace-setup-presentation";

function snapshot(
  status: WorkspaceSetupSnapshot["status"],
  updatedAt: number,
): WorkspaceSetupSnapshot {
  return {
    workspaceId: "workspace-1",
    status,
    detail: {
      type: "worktree_setup",
      worktreePath: "/repo/worktree",
      branchName: "feature",
      log: "",
      commands: [],
    },
    error: null,
    updatedAt,
  };
}

describe("workspace setup presentation", () => {
  it("focuses running setup regardless of snapshot age", () => {
    expect(resolveWorkspaceSetupAutoOpenMode(snapshot("running", 1), 1_000_000)).toBe("focused");
  });

  it("opens a recent terminal setup in the background", () => {
    expect(resolveWorkspaceSetupAutoOpenMode(snapshot("completed", 1_000), 2_000)).toBe(
      "background",
    );
  });

  it("does not auto-open an old terminal setup", () => {
    expect(
      resolveWorkspaceSetupAutoOpenMode(
        snapshot("failed", 1_000),
        1_000 + WORKSPACE_SETUP_AUTO_OPEN_WINDOW_MS + 1,
      ),
    ).toBeNull();
  });
});
