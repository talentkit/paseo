import { expect, test } from "../support/fixtures";
import { DirectoryBootstrapScenario } from "../support/helpers/directory-bootstrap-scenario";
import { expectComposerVisible } from "../support/helpers/composer";
import { openAgentRoute, seedMockAgentWorkspace } from "../support/helpers/mock-agent";
import { readReplicaCache, writeReplicaCache } from "../support/helpers/replica-cache-storage";

test.describe("Directory bootstrap correctness", () => {
  test("connect, pushed deltas, and reconnect keep directories current without duplicate bootstraps", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const scenario = await DirectoryBootstrapScenario.open(page);
    try {
      await scenario.expectDirectoryStarts(1);
      await scenario.stayConnectedWithoutRefetchAndApplyDeltas();
      await scenario.disconnectMutateAndReconnect();
      await scenario.expectVisibleReconciliationAndNavigateAgent();
    } finally {
      await scenario.cleanup();
    }
  });

  test("workspace links survive reload and recover from a cache that omitted them", async ({
    page,
  }) => {
    const agent = await seedMockAgentWorkspace({
      repoPrefix: "workspace-links-reload-",
      title: "Workspace links reload",
      repo: {
        paseoConfig: {
          scripts: {
            "Open in Code": {
              type: "link",
              url: "https://code.example.com/?folder={workspacePath}",
            },
            Documentation: { type: "link", url: "https://docs.example.com/" },
          },
        },
      },
    });
    try {
      await openAgentRoute(page, agent);
      await expectComposerVisible(page);
      await page.getByTestId("workspace-open-in-editor-caret").click();
      await expect(
        page.getByTestId("workspace-open-in-editor-item-workspace-link:Open in Code"),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect
        .poll(async () => {
          const cache = await readReplicaCache(page);
          for (const host of cache?.hosts ?? []) {
            for (const workspace of host.workspaces) {
              if (workspace.id === agent.workspaceId) return workspace.links;
            }
          }
          return null;
        })
        .toEqual([
          { name: "Documentation", url: "https://docs.example.com/" },
          {
            name: "Open in Code",
            url: `https://code.example.com/?folder=${encodeURIComponent(agent.cwd)}`,
          },
        ]);

      await page.reload();
      await expectComposerVisible(page);
      await page.getByTestId("workspace-open-in-editor-caret").click();
      await expect(
        page.getByTestId("workspace-open-in-editor-item-workspace-link:Open in Code"),
      ).toBeVisible();
      await page.keyboard.press("Escape");

      const cache = await readReplicaCache(page);
      if (!cache) throw new Error("Expected the persisted workspace cache");
      for (const host of cache.hosts ?? []) {
        for (const workspace of host.workspaces) delete workspace.links;
      }
      await writeReplicaCache(page, cache);
      await page.reload();
      await expectComposerVisible(page);
      await page.getByTestId("workspace-open-in-editor-caret").click();
      await expect(
        page.getByTestId("workspace-open-in-editor-item-workspace-link:Open in Code"),
      ).toBeVisible();
    } finally {
      await agent.cleanup();
    }
  });
});
