import { describe, expect, it, vi } from "vitest";
import { WorkspaceSetupFailedError, WorkspaceSetupReadiness } from "./workspace-setup-readiness.js";

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
} {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("WorkspaceSetupReadiness", () => {
  it("blocks waiters until the shared setup completes", async () => {
    const readiness = new WorkspaceSetupReadiness();
    const setup = deferred();
    const waiterFinished = vi.fn();

    readiness.start("wks_setup", "/worktrees/feature", () => setup.promise);
    const waiter = readiness.waitUntilReady("wks_setup").then(waiterFinished);
    await Promise.resolve();

    expect(waiterFinished).not.toHaveBeenCalled();
    setup.resolve();
    await waiter;
    expect(waiterFinished).toHaveBeenCalledOnce();
  });

  it("keeps setup failures sticky for later agent requests", async () => {
    const readiness = new WorkspaceSetupReadiness();
    const setupError = new Error("dependencies failed");

    readiness.start("wks_failed", "/worktrees/failed", async () => {
      throw setupError;
    });

    await expect(readiness.waitUntilReady("wks_failed")).rejects.toEqual(
      new WorkspaceSetupFailedError("wks_failed", setupError),
    );
    await expect(readiness.waitUntilReady("wks_failed")).rejects.toEqual(
      new WorkspaceSetupFailedError("wks_failed", setupError),
    );
  });

  it("treats workspaces without a setup entry as ready", async () => {
    const readiness = new WorkspaceSetupReadiness();
    await expect(readiness.waitUntilReady("wks_local")).resolves.toBeUndefined();
  });

  it("forgets readiness and snapshots when a workspace is removed", async () => {
    const readiness = new WorkspaceSetupReadiness();
    const setup = deferred();
    let setupSignal: AbortSignal | undefined;
    const snapshot = {
      status: "running" as const,
      detail: { commands: [], log: "" },
      error: null,
    };

    readiness.start("wks_removed", "/worktrees/removed", (signal) => {
      setupSignal = signal;
      return setup.promise;
    });
    await Promise.resolve();
    readiness.setSnapshot("wks_removed", snapshot);
    readiness.forget("wks_removed");

    expect(setupSignal?.aborted).toBe(true);
    expect(readiness.getSnapshot("wks_removed")).toBeNull();
    await expect(readiness.waitUntilReady("wks_removed")).resolves.toBeUndefined();
    setup.resolve();
  });

  it("shares readiness between workspaces backed by the same worktree", async () => {
    const readiness = new WorkspaceSetupReadiness();
    const setup = deferred();
    const reusedSetup = vi.fn(async () => {});

    readiness.start("wks_first", "/worktrees/shared", () => setup.promise);
    readiness.setSnapshot("wks_first", {
      status: "running",
      detail: {
        type: "worktree_setup",
        worktreePath: "/worktrees/shared",
        branchName: "shared",
        commands: [],
        log: "",
      },
      error: null,
    });
    readiness.start("wks_second", "/worktrees/shared", reusedSetup);
    expect(readiness.getSnapshot("wks_second")?.status).toBe("running");

    let secondReady = false;
    const waiter = readiness.waitUntilReady("wks_second").then(() => {
      secondReady = true;
      return undefined;
    });
    await Promise.resolve();
    expect(secondReady).toBe(false);
    expect(reusedSetup).not.toHaveBeenCalled();

    setup.resolve();
    await waiter;
    expect(secondReady).toBe(true);
  });

  it("runs setup again after the final workspace for a worktree is forgotten", async () => {
    const readiness = new WorkspaceSetupReadiness();
    const firstSetup = vi.fn(async () => {});
    const secondSetup = vi.fn(async () => {});

    readiness.start("wks_first", "/worktrees/recreated", firstSetup);
    await readiness.waitUntilReady("wks_first");
    readiness.forget("wks_first");
    readiness.start("wks_second", "/worktrees/recreated", secondSetup);
    await readiness.waitUntilReady("wks_second");

    expect(firstSetup).toHaveBeenCalledOnce();
    expect(secondSetup).toHaveBeenCalledOnce();
  });

  it("persists readiness and restores interrupted setup as failed", async () => {
    const transitions: string[] = [];
    const readiness = new WorkspaceSetupReadiness({
      markPending: async (workspaceId) => {
        transitions.push(`${workspaceId}:pending`);
      },
      markCompleted: async (workspaceId) => {
        transitions.push(`${workspaceId}:completed`);
      },
      markFailed: async (workspaceId, error) => {
        transitions.push(`${workspaceId}:failed:${error}`);
      },
    });

    readiness.start("wks_persisted", "/worktrees/persisted", async () => {});
    await readiness.waitUntilReady("wks_persisted");
    expect(transitions).toEqual(["wks_persisted:pending", "wks_persisted:completed"]);

    readiness.restoreInterrupted(
      "wks_interrupted",
      "/worktrees/interrupted",
      null,
      "Workspace setup was interrupted by a daemon restart",
    );
    await expect(readiness.waitUntilReady("wks_interrupted")).rejects.toThrow(
      "Workspace setup was interrupted by a daemon restart",
    );
  });

  it("reports persistence failures through the readiness barrier", async () => {
    const persistenceError = new Error("failed to persist setup completion");
    const readiness = new WorkspaceSetupReadiness({
      markPending: async () => {},
      markCompleted: async () => {
        throw persistenceError;
      },
      markFailed: async () => {},
    });

    await readiness.start(
      "wks_persistence_failed",
      "/worktrees/persistence-failed",
      async () => {},
    );

    await expect(readiness.waitUntilReady("wks_persistence_failed")).rejects.toEqual(
      new WorkspaceSetupFailedError("wks_persistence_failed", persistenceError),
    );
  });
});
