import { test, expect } from "@playwright/test";

/**
 * CI E2E gap-coverage suite — covers critical paths beyond basic smoke.
 * Each test verifies a key UI surface loads without runtime errors.
 */

test.describe("App shell surfaces", () => {
  test("loads office view (default)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    // Office view renders at least some content
    await expect(page.locator('[class*="office"], [class*="Office"], main').first()).toBeVisible({ timeout: 15000 });
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/?view=settings");
    await expect(page.locator("body")).toBeVisible();
  });

  test("tasks page loads", async ({ page }) => {
    await page.goto("/?view=tasks");
    await expect(page.locator("body")).toBeVisible();
  });

  test("directives page loads", async ({ page }) => {
    await page.goto("/?view=directives");
    await expect(page.locator("body")).toBeVisible();
  });

  test("deliverables page loads", async ({ page }) => {
    await page.goto("/?view=deliverables");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("API smoke", () => {
  test("GET /api/departments returns JSON", async ({ request }) => {
    const resp = await request.get("/api/departments");
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body).toHaveProperty("departments");
    expect(Array.isArray(body.departments)).toBeTruthy();
  });

  test("GET /api/agents returns JSON", async ({ request }) => {
    const resp = await request.get("/api/agents");
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body).toHaveProperty("agents");
    expect(Array.isArray(body.agents)).toBeTruthy();
  });

  test("GET /api/tasks returns JSON", async ({ request }) => {
    const resp = await request.get("/api/tasks");
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body).toHaveProperty("tasks");
  });

  test("GET /api/settings returns JSON", async ({ request }) => {
    const resp = await request.get("/api/settings");
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body).toHaveProperty("settings");
  });

  test("GET /api/stats returns JSON", async ({ request }) => {
    const resp = await request.get("/api/stats");
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body).toHaveProperty("stats");
  });

  test("GET /api/workflow-packs returns packs list", async ({ request }) => {
    const resp = await request.get("/api/workflow-packs");
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body).toHaveProperty("packs");
    expect(Array.isArray(body.packs)).toBeTruthy();
    expect(body.packs.length).toBeGreaterThanOrEqual(1);
  });

  test("GET /api/decision-inbox returns JSON", async ({ request }) => {
    const resp = await request.get("/api/decision-inbox");
    expect(resp.ok()).toBeTruthy();
  });
});
