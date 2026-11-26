import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, expect, type Page } from "../support/fixtures";
import {
  openAgentRoute,
  seedMockAgentWorkspace,
  type MockAgentWorkspace,
} from "../support/helpers/mock-agent";

async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

async function readFileLinkTooltip(page: Page): Promise<void> {
  const link = page.getByRole("link", { name: "the guide", exact: true });
  await link.hover();
  await expect(page.getByRole("tooltip")).toContainText("guide.md");
}

async function leaveFileLink(page: Page): Promise<void> {
  await page.mouse.move(5, 5);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
}

async function openLinkedFile(page: Page): Promise<void> {
  await page.getByRole("link", { name: "the guide", exact: true }).click();
  await expect(page.getByTestId("markdown-preview-frame")).toContainText("Example guide");
  await leaveFileLink(page);
}

async function returnToAgent(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Tooltip regression", exact: true }).click();
  await expect(page.getByRole("link", { name: "the guide", exact: true })).toBeVisible();
  await leaveFileLink(page);
}

async function switchToFileTab(page: Page): Promise<void> {
  await page.getByRole("button", { name: "guide.md", exact: true }).click();
  await expect(page.getByTestId("markdown-preview-frame")).toContainText("Example guide");
  await leaveFileLink(page);
}

test("opening an assistant file link dismisses its tooltip over the file tab", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(120_000);
  const agent = await seedMockAgentWorkspace({
    repoPrefix: "tooltip-5811-",
    title: "Tooltip regression",
    featureValues: {
      mockStreamingAssistantResponse: "Read [the guide](./guide.md).",
      mockStreamingAssistantIntervalMs: 5,
    },
  });
  try {
    await writeFile(
      path.join(agent.cwd, "guide.md"),
      "# Example guide\n\n" + "Plain paragraph.\n\n".repeat(150),
    );
    await openAgentRoute(page, agent);
    await agent.client.sendAgentMessage(agent.agentId, "Show the file link.");
    await agent.client.waitForFinish(agent.agentId, 30_000);

    await readFileLinkTooltip(page);
    await leaveFileLink(page);
    await readFileLinkTooltip(page);
    await openLinkedFile(page);
    await returnToAgent(page);
    await readFileLinkTooltip(page);
    await switchToFileTab(page);
    await returnToAgent(page);
    await readFileLinkTooltip(page);
    await leaveFileLink(page);
  } finally {
    await agent.cleanup();
  }
});

async function readLinkedGuide(page: Page, linkName: string, content: string): Promise<void> {
  await page.getByRole("link", { name: linkName, exact: true }).click();
  await expect(page.getByTestId("markdown-preview-frame").filter({ visible: true })).toContainText(
    content,
  );
}

async function returnToNestedLinks(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Nested file links", exact: true }).click();
  await expect(page.getByRole("link", { name: "nested guide", exact: true })).toBeVisible();
}

test("assistant directory paths find nested files and preserve exact workspace paths", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(120_000);
  const agent = await seedMockAgentWorkspace({
    repoPrefix: "nested-file-link-",
    title: "Nested file links",
    featureValues: {
      mockStreamingAssistantResponse:
        "Read [nested guide](schema/x.md), [exact guide](schema/exact.md), and [missing guide](schema/missing.md).",
      mockStreamingAssistantIntervalMs: 5,
    },
  });
  try {
    await mkdir(path.join(agent.cwd, "repo-a/schema"), { recursive: true });
    execFileSync("git", ["init", "-b", "main"], { cwd: path.join(agent.cwd, "repo-a") });
    await writeFile(
      path.join(agent.cwd, "repo-a/schema/x.md"),
      "# Nested file content\n\nDetails\n",
    );
    await mkdir(path.join(agent.cwd, "schema"), { recursive: true });
    await writeFile(path.join(agent.cwd, "schema/exact.md"), "# Exact file content\n");
    await writeFile(path.join(agent.cwd, "repo-a/schema/exact.md"), "# Wrong nested content\n");
    await openAgentRoute(page, agent);
    await agent.client.sendAgentMessage(agent.agentId, "Show the file links.");
    await agent.client.waitForFinish(agent.agentId, 30_000);

    await expect(page.getByRole("textbox", { name: "Message agent..." }).first()).toBeEnabled();
    await readLinkedGuide(page, "nested guide", "Nested file content");
    await returnToNestedLinks(page);
    await readLinkedGuide(page, "exact guide", "Exact file content");
    await returnToNestedLinks(page);
    await page.getByRole("link", { name: "missing guide", exact: true }).click();
    await expect(page.getByText("File not found", { exact: true })).toBeVisible();
  } finally {
    await agent.cleanup();
  }
});

test.describe("assistant file link context actions", () => {
  const filename = "résumé final.md";
  const binary = Buffer.from([0, 1, 128, 255]);
  let agent: MockAgentWorkspace;

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    agent = await seedMockAgentWorkspace({
      repoPrefix: "chat-file-actions-",
      title: "File link actions",
      featureValues: {
        mockAssistantResponse:
          "[the report](docs/r%C3%A9sum%C3%A9%20final.md:7) [binary](docs/report.bin) `missing.md` `docs/literal%20name.md` [encoded](docs/literal%2520name.md:3) [home file](~/paseo-home-link.md:5) [outside](/tmp/paseo-outside.md:6) [website](https://example.com)",
      },
    });
    await mkdir(path.join(agent.cwd, "docs"));
    await writeFile(path.join(agent.cwd, "docs", filename), "# Example report\n");
    await writeFile(path.join(agent.cwd, "docs/report.bin"), binary);
    await writeFile(path.join(agent.cwd, "docs/literal%20name.md"), "# Literal filename\n");
    await agent.client.sendAgentMessage(agent.agentId, "Show the files.");
    await agent.client.waitForFinish(agent.agentId, 30_000);
    await openAgentRoute(page, agent);
  });

  test.afterEach(async () => {
    await agent.cleanup();
  });

  async function openMenu(page: Page, name = "the report") {
    await page.getByRole("link", { name, exact: true }).click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Copy path", exact: true })).toBeVisible();
  }

  async function expectCopiedReport(page: Page) {
    await page.getByRole("menuitem", { name: /^Copy path/ }).click();
    await expect(page.getByRole("menuitem", { name: "Copied", exact: true })).toBeVisible();
    const expected = path.join(agent.cwd, "docs", filename).replaceAll("\\", "/");
    await expect.poll(() => readClipboard(page)).toBe(expected);
  }

  test("file actions work on history after a reload and copy a decoded path without its line suffix", async ({
    page,
  }, testInfo) => {
    await page.reload();
    await openMenu(page);
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("file-link-menu-desktop.png"),
    });
    await expectCopiedReport(page);
  });

  test("keyboard opens the file menu and Escape returns focus to the link", async ({ page }) => {
    const link = page.getByRole("link", { name: "the report", exact: true });
    await link.focus();
    await page.keyboard.press("Shift+F10");
    await expect(page.getByRole("menuitem", { name: "Copy path", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(link).toBeFocused();
  });

  test("reveals the containing folder in Paseo and selects the linked file", async ({ page }) => {
    await openMenu(page);
    await page.getByRole("menuitem", { name: "Reveal in Paseo", exact: true }).click();
    const tree = page.getByTestId("file-explorer-tree-scroll");
    await expect(tree.getByText(filename, { exact: true })).toBeVisible();
    await expect(tree.locator('[aria-selected="true"]')).toContainText(filename);
  });

  test("downloads a linked binary through the existing file download flow", async ({
    page,
  }, testInfo) => {
    await openMenu(page, "binary");
    const received = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Download", exact: true }).click();
    const download = await received;
    const destination = testInfo.outputPath("report.bin");
    await download.saveAs(destination);
    expect(await readFile(destination)).toEqual(binary);
  });

  test("a missing inline path keeps an error visible and can be retried after the file is created", async ({
    page,
  }) => {
    await openMenu(page, "missing.md");
    await page.getByRole("menuitem", { name: "Copy path", exact: true }).click();
    await expect(page.getByText("No file found for missing.md", { exact: true })).toBeVisible();
    await writeFile(path.join(agent.cwd, "missing.md"), "Now present\n");
    await page.getByRole("menuitem", { name: /^Copy path/ }).click();
    await expect(page.getByRole("menuitem", { name: "Copied", exact: true })).toBeVisible();
  });

  test("copying a literal percent filename preserves it for both link syntaxes", async ({
    page,
  }) => {
    for (const name of ["docs/literal%20name.md", "encoded"]) {
      await openMenu(page, name);
      await page.getByRole("menuitem", { name: "Copy path", exact: true }).click();
      await expect(page.getByRole("menuitem", { name: "Copied", exact: true })).toBeVisible();
      await expect
        .poll(() => readClipboard(page))
        .toBe(path.join(agent.cwd, "docs/literal%20name.md").replaceAll("\\", "/"));
      await page.keyboard.press("Escape");
    }
  });

  test("copying outside-workspace and home-relative paths keeps their host meaning", async ({
    page,
  }) => {
    for (const [name, expected] of [
      ["outside", "/tmp/paseo-outside.md"],
      ["home file", "~/paseo-home-link.md"],
    ]) {
      await openMenu(page, name);
      await page.getByRole("menuitem", { name: "Copy path", exact: true }).click();
      await expect(page.getByRole("menuitem", { name: "Copied", exact: true })).toBeVisible();
      await expect.poll(() => readClipboard(page)).toBe(expected);
      await page.keyboard.press("Escape");
    }
  });

  test("clipboard denial stays visible until the user retries successfully", async ({
    page,
    context,
  }) => {
    const session = await context.newCDPSession(page);
    const { targetInfo } = await session.send("Target.getTargetInfo");
    const permission = {
      permission: { name: "clipboard-write", allowWithoutSanitization: false },
      origin: new URL(page.url()).origin,
      browserContextId: targetInfo.browserContextId,
    };
    await session.send("Browser.setPermission", { ...permission, setting: "denied" });
    await openMenu(page);
    await page.getByRole("menuitem", { name: "Copy path", exact: true }).click();
    await expect(page.getByText(/Unable to copy/)).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Copied", exact: true })).toHaveCount(0);
    await session.send("Browser.setPermission", { ...permission, setting: "granted" });
    await expectCopiedReport(page);
    await expect(page.getByText(/Unable to copy/)).toHaveCount(0);
  });

  test("web URLs do not acquire file actions", async ({ page }) => {
    await page.getByRole("link", { name: "website", exact: true }).click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Copy path", exact: true })).toHaveCount(0);
  });

  test("compact layouts offer the same file actions in a sheet", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openMenu(page);
    await expect(
      page.getByRole("menuitem", { name: "Reveal in Paseo", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Download", exact: true })).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("file-link-menu-compact.png"),
    });
    await expectCopiedReport(page);
  });
});
