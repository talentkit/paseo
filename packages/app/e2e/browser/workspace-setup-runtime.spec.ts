import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "../support/fixtures";
import { connectDaemonClient } from "../support/helpers/daemon-client-loader";
import { installDaemonWebSocketGate } from "../support/helpers/daemon-websocket-gate";
import type { SeedDaemonClient } from "../support/helpers/seed-client";
import { createTempGitRepo } from "../support/helpers/workspace";
import { clickNewTerminal } from "../support/helpers/launcher";
import { expectTerminalSurfaceVisible } from "../support/helpers/terminal-perf";
import {
  connectWorkspaceSetupClient,
  createWorkspaceThroughDaemon,
  expectSetupLogContains,
  expectSetupPanel,
  expectSetupStatus,
  findWorktreeWorkspaceForProject,
  navigateToWorkspaceViaSidebar,
  openHomeWithProject,
  seedProjectForWorkspaceSetup,
} from "../support/helpers/workspace-setup";

type WorkspaceCreatorClient = Pick<SeedDaemonClient, "connect" | "close" | "createWorkspace">;

test.describe("Workspace setup runtime authority", () => {
  test.describe.configure({ retries: 1 });

  test("reconciles setup after the creator exits and the browser reconnects", async ({
    page,
    e2eWorkerClient,
  }) => {
    test.setTimeout(90_000);

    const gate = await installDaemonWebSocketGate(page);
    const repo = await createTempGitRepo("workspace-setup-reconnect-", {
      paseoConfig: {
        worktree: { setup: "node support/wait-for-release.mjs" },
      },
      files: [
        {
          path: "support/wait-for-release.mjs",
          content: `import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const source = process.env.PASEO_SOURCE_CHECKOUT_PATH;
const worktree = process.env.PASEO_WORKTREE_PATH;
if (!source || !worktree) throw new Error("Missing Paseo worktree environment");
console.log("setup waiting");
while (!existsSync(path.join(source, ".release-setup"))) {
  await new Promise((resolve) => setTimeout(resolve, 50));
}
writeFileSync(path.join(worktree, ".setup-finished"), "ok\\n");
console.log("setup released");
`,
        },
      ],
    });
    const releasePath = path.join(repo.path, ".release-setup");
    let projectId: string | null = null;
    let creator: WorkspaceCreatorClient | null = null;

    try {
      const projectResult = await e2eWorkerClient.addProject(repo.path);
      if (!projectResult.project || projectResult.error) {
        throw new Error(projectResult.error ?? "Failed to create setup test project");
      }
      projectId = projectResult.project.projectId;

      await openHomeWithProject(page, repo.path);
      creator = await connectDaemonClient<WorkspaceCreatorClient>({
        clientIdPrefix: "workspace-setup-short-lived-creator",
      });
      const result = await Promise.race([
        creator.createWorkspace({
          source: {
            kind: "worktree",
            projectId,
            baseBranch: "main",
            worktreeSlug: `setup-reconnect-${Date.now()}`,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Workspace creation blocked on setup")), 10_000),
        ),
      ]);
      if (!result.workspace || result.error) {
        throw new Error(result.error ?? "Failed to create setup test workspace");
      }
      const workspace = result.workspace;
      await creator.close();
      creator = null;

      await navigateToWorkspaceViaSidebar(page, workspace.id);
      await expectSetupPanel(page);
      await expectSetupStatus(page, "Running");
      await expectSetupLogContains(page, "setup waiting");

      await gate.drop();
      writeFileSync(releasePath, "ok\n");
      await expect
        .poll(() => existsSync(path.join(workspace.workspaceDirectory, ".setup-finished")), {
          timeout: 30_000,
        })
        .toBe(true);

      gate.restore();
      await expectSetupStatus(page, "Completed");
      await expectSetupLogContains(page, "setup released");
    } finally {
      writeFileSync(releasePath, "ok\n");
      gate.restore();
      await creator?.close().catch(() => undefined);
      if (projectId) {
        await e2eWorkerClient.removeProject(projectId).catch(() => undefined);
      }
      await repo.cleanup();
    }
  });

  test("worktree workspace is created in its own directory", async ({ page }) => {
    test.setTimeout(90_000);

    const client = await connectWorkspaceSetupClient();
    const repo = await createTempGitRepo("workspace-setup-chat-");

    try {
      await seedProjectForWorkspaceSetup(client, repo.path);
      const workspace = await createWorkspaceThroughDaemon(client, {
        cwd: repo.path,
        worktreeSlug: `setup-chat-${Date.now()}`,
      });
      const workspaceId = workspace.id;

      const wsInfo = await findWorktreeWorkspaceForProject(client, repo.path);
      expect(wsInfo.workspaceDirectory).not.toBe(repo.path);
      expect(existsSync(wsInfo.workspaceDirectory)).toBe(true);

      await openHomeWithProject(page, repo.path);
      await navigateToWorkspaceViaSidebar(page, workspaceId);
      await expect(page).toHaveURL(/\/workspace\//, { timeout: 30_000 });
    } finally {
      await client.close();
      await repo.cleanup();
    }
  });

  test("first terminal opens in the created workspace directory", async ({ page }) => {
    test.setTimeout(90_000);

    const client = await connectWorkspaceSetupClient();
    const repo = await createTempGitRepo("workspace-setup-terminal-");

    try {
      await seedProjectForWorkspaceSetup(client, repo.path);

      // Create workspace via daemon API since the new workspace screen
      // no longer has a standalone terminal button
      const worktreeSlug = `setup-terminal-${Date.now()}`;
      const result = await client.createPaseoWorktree({
        cwd: repo.path,
        worktreeSlug,
      });
      if (!result.workspace || result.error) {
        throw new Error(result.error ?? "Failed to create workspace");
      }
      const workspaceDir = result.workspace.workspaceDirectory;
      const workspaceId = result.workspace.id;

      // Navigate to the worktree workspace via sidebar click (direct URL
      // navigation for freshly created worktree workspaces can race with
      // Expo Router hydration, so we use the sidebar which is authoritative).
      await openHomeWithProject(page, repo.path);
      await navigateToWorkspaceViaSidebar(page, workspaceId);

      await clickNewTerminal(page);
      await expectTerminalSurfaceVisible(page);

      // Verify terminal is listed under the worktree directory, not the original repo
      await expect
        .poll(async () => (await client.listTerminals(workspaceDir)).terminals.length > 0, {
          timeout: 30_000,
        })
        .toBe(true);
      expect((await client.listTerminals(repo.path)).terminals.length).toBe(0);
    } finally {
      await client.close();
      await repo.cleanup();
    }
  });
});
