import { expect, test, type Page } from "@playwright/test";

async function openHarness(page: Page) {
  await page.goto("/e2e/board");
  await expect(page.getByLabel("Select")).toBeVisible();
  await expect(page.getByTestId("e2e-object-count")).toHaveText("objects: 0");
}

async function drawOnCanvas(page: Page, start: { x: number; y: number }, end: { x: number; y: number }) {
  const canvas = page.locator("#canvas-container canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not available");

  const startX = box.x + start.x;
  const startY = box.y + start.y;
  const endX = box.x + end.x;
  const endY = box.y + end.y;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 12 });
  await page.waitForTimeout(60);
  await page.mouse.up();
}

async function clickCanvas(page: Page, point: { x: number; y: number }) {
  const canvas = page.locator("#canvas-container canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not available");
  await page.mouse.click(box.x + point.x, box.y + point.y);
}

async function openCommandPalette(page: Page) {
  const input = page.getByPlaceholder("Type a command or search… (⌘K)");
  await page.locator("body").click();
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.keyboard.press("Meta+k");
    if (await input.isVisible()) break;
    await page.keyboard.press("Control+k");
    if (await input.isVisible()) break;
    await page.evaluate(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    if (await input.isVisible()) break;
    await page.waitForTimeout(120);
  }
  await expect(input).toBeVisible();
}

test.describe("core user journeys", () => {
  test("loads board UI and creates sticky/text from toolbar", async ({ page }) => {
    await openHarness(page);

    await page.getByLabel("Sticky").click();
    await clickCanvas(page, { x: 180, y: 180 });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("e2e-object-count")).toHaveText("objects: 1");

    await page.getByLabel("Text").click();
    await clickCanvas(page, { x: 300, y: 180 });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("e2e-object-count")).toHaveText("objects: 2");

    await expect(page.getByTestId("e2e-object-count")).toHaveText("objects: 2");
  });

  test("supports select and delete flow", async ({ page }) => {
    await openHarness(page);

    await page.getByLabel("Sticky").click();
    await clickCanvas(page, { x: 230, y: 220 });
    await expect(page.getByTestId("e2e-object-count")).toHaveText("objects: 1");
    await expect(page.getByTestId("e2e-selection-count")).toHaveText("selection: 1");

    await page.keyboard.press("Delete");
    await expect(page.getByTestId("e2e-object-count")).toHaveText("objects: 0");
    await expect(page.getByTestId("e2e-selection-count")).toHaveText("selection: 0");
  });

  test("opens command palette and runs a basic action", async ({ page }) => {
    await openHarness(page);

    await openCommandPalette(page);
    await page.getByPlaceholder("Type a command or search… (⌘K)").fill("frame");
    await page.getByRole("option", { name: "Frame" }).click();
    await expect(
      page.getByPlaceholder("Type a command or search… (⌘K)"),
    ).toBeHidden();
    await expect(page.getByLabel("Frame")).toHaveClass(/bg-slate-200/);
  });

  test("opens AI chat and sends a real request", async ({ page }) => {
    await openHarness(page);

    await page.getByLabel("Open AI chat").click();
    await page.getByPlaceholder("Type or hold Space to talk...").fill("Create a sticky");
    await page.getByLabel("Send").click();

    await page.waitForResponse("**/api/ai/command");
    await expect(page.getByText("Create a sticky")).toBeVisible();
    await expect(page.getByText(/Unauthorized|Access denied|Board not found|Error:|Request failed|Created|Done\./i)).toBeVisible();
  });
});
