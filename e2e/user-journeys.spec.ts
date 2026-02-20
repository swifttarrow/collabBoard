import { expect, test, type Page } from "@playwright/test";

async function mockBoardApis(page: Page) {
  await page.route(/\/api\/boards\/[^/]+\/snapshot$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ objects: {}, revision: 0 }),
    });
  });

  await page.route(/\/api\/boards\/[^/]+\/ops$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, revision: 1 }),
    });
  });

  await page.route(/\/api\/boards\/[^/]+\/save-checkpoint$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
}

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
  await page.mouse.move(endX, endY);
  await page.mouse.up();
}

test.describe("core user journeys", () => {
  test.beforeEach(async ({ page }) => {
    await mockBoardApis(page);
  });

  test("loads board UI and creates core object types from toolbar", async ({ page }) => {
    await openHarness(page);
    const canvas = page.locator("#canvas-container canvas").first();

    await page.getByLabel("Sticky").click();
    await canvas.click({ position: { x: 180, y: 180 } });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("e2e-object-count")).toHaveText("objects: 1");

    await page.getByLabel("Text").click();
    await canvas.click({ position: { x: 300, y: 180 } });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("e2e-object-count")).toHaveText("objects: 2");

    await page.getByLabel("Frame").click();
    await drawOnCanvas(page, { x: 200, y: 260 }, { x: 360, y: 370 });
    await expect(page.getByTestId("e2e-object-count")).toHaveText("objects: 3");

    await page.getByLabel("Shapes").click();
    await page.getByText("Rectangle").click();
    await drawOnCanvas(page, { x: 430, y: 240 }, { x: 560, y: 320 });
    await expect(page.getByTestId("e2e-object-count")).toHaveText("objects: 4");

    await page.getByLabel("Line").click();
    await page.getByText("No arrow").click();
    await drawOnCanvas(page, { x: 620, y: 260 }, { x: 760, y: 340 });
    await expect(page.getByTestId("e2e-object-count")).toHaveText("objects: 5");
  });

  test("supports select and delete flow", async ({ page }) => {
    await openHarness(page);
    const canvas = page.locator("#canvas-container canvas").first();

    await page.getByLabel("Sticky").click();
    await canvas.click({ position: { x: 230, y: 220 } });
    await expect(page.getByTestId("e2e-object-count")).toHaveText("objects: 1");
    await expect(page.getByTestId("e2e-selection-count")).toHaveText("selection: 1");

    await page.keyboard.press("Delete");
    await expect(page.getByTestId("e2e-object-count")).toHaveText("objects: 0");
    await expect(page.getByTestId("e2e-selection-count")).toHaveText("selection: 0");
  });

  test("opens command palette and runs a basic action", async ({ page }) => {
    await openHarness(page);

    await page.keyboard.press("ControlOrMeta+KeyK");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.getByPlaceholder("Type a command or search… (⌘K)").fill("frame");
    await page.getByText("Frame").click();
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeHidden();
    await expect(page.getByLabel("Frame")).toHaveClass(/bg-slate-200/);
  });

  test("opens AI chat and sends a mocked request", async ({ page }) => {
    await page.route("**/api/ai/command", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: "Automated AI response",
      });
    });

    await openHarness(page);

    await page.getByLabel("Open AI chat").click();
    await page.getByPlaceholder("Type or hold Space to talk...").fill("Create a sticky");
    await page.getByLabel("Send").click();

    await expect(page.getByText("Create a sticky")).toBeVisible();
    await expect(page.getByText("Automated AI response")).toBeVisible();
  });
});
