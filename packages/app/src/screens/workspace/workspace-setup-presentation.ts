import type { WorkspaceSetupSnapshot } from "@/stores/workspace-setup-store";

export const WORKSPACE_SETUP_AUTO_OPEN_WINDOW_MS = 30_000;

export type WorkspaceSetupAutoOpenMode = "focused" | "background";

export function resolveWorkspaceSetupAutoOpenMode(
  snapshot: WorkspaceSetupSnapshot,
  now: number,
): WorkspaceSetupAutoOpenMode | null {
  if (snapshot.status === "running") {
    return "focused";
  }
  return now - snapshot.updatedAt <= WORKSPACE_SETUP_AUTO_OPEN_WINDOW_MS ? "background" : null;
}
