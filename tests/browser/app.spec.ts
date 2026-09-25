import { test, expect } from "@playwright/test";
const passphrase = "browser-test-only-passphrase-2026";
async function login(page) {
  await page.goto("/");
  await page.getByLabel("Owner passphrase", { exact: true }).fill(passphrase);
  if (await page.getByLabel("Confirm passphrase").count())
    await page.getByLabel("Confirm passphrase").fill(passphrase);
  await page.locator("#auth-form button").click();
  await expect(
    page.getByRole("heading", { name: "Good to see you, Matt." }),
  ).toBeVisible();
}
test("owner controls, office, durable note, settings and responsive navigation", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const missionTitle = `Browser verification ${testInfo.project.name} ${Date.now()}`;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("button", { name: "New mission", exact: false }).click();
  await page.getByLabel("Mission title").fill(missionTitle);
  await page
    .getByLabel("Brief", { exact: true })
    .fill("Verify a persisted mission without inventing runtime execution.");
  await page
    .getByRole("button", { name: "Create mission", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: missionTitle, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Your crew", exact: true }).click();
  await page
    .getByRole("button", { name: "Enter office", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Jeff’s office" }),
  ).toBeVisible();
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  const officeDiagnostics = JSON.parse(
    (await page.locator("#world").getAttribute("data-diagnostics")) || "{}",
  );
  expect(officeDiagnostics.failures).toEqual([]);
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-office.png`,
    fullPage: true,
  });
  await page
    .getByLabel("Message Jeff", { exact: true })
    .fill("A note recorded from the browser acceptance test.");
  await page.getByRole("button", { name: "Send note", exact: false }).click();
  await expect(
    page
      .locator(".message")
      .filter({ hasText: "A note recorded from the browser acceptance test." })
      .first(),
  ).toContainText("Queued");
  await page
    .getByRole("button", { name: "Back to city", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "Good to see you, Matt." }),
  ).toBeVisible();
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-city.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("city buildings and office avatars respond to actual canvas clicks", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Fixed desktop camera geometry is checked once; responsive controls are covered separately.",
  );
  test.setTimeout(120000);
  await login(page);
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.screenshot({ path: "test-results/city-picking.png" });
  const city = (await page.locator("#world").boundingBox())!;
  await page.mouse.click(
    city.x + city.width * 0.35,
    city.y + city.height * 0.48,
  );
  await expect(
    page.getByRole("heading", { name: "Jeff’s office", hidden: true }),
  ).toBeAttached();
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.screenshot({ path: "test-results/office-picking.png" });
  const office = (await page.locator("#world").boundingBox())!;
  await page.mouse.click(
    office.x + office.width * 0.48,
    office.y + office.height * 0.57,
  );
  await expect(
    page.getByRole("heading", { name: "Jeff - details" }),
  ).toBeVisible();
  await expect(page.locator(".expanded-viewer")).toHaveCount(0);
});

test("curated rooms load for the remaining crew", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "The same asset catalog is checked once.",
  );
  test.setTimeout(120000);
  await login(page);
  for (const id of ["jefferson", "relay", "jev"]) {
    await page.getByRole("button", { name: "Your crew", exact: true }).click();
    await page.locator(`[data-action="office"][data-id="${id}"]`).click();
    await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
      timeout: 30000,
    });
    const diagnostics = JSON.parse(
      (await page.locator("#world").getAttribute("data-diagnostics")) || "{}",
    );
    expect(
      diagnostics.failures,
      `${id} room should load all curated assets`,
    ).toEqual([]);
    if (id === "relay")
      await page.screenshot({ path: "test-results/relay-office.png" });
  }
});
test("office polling keeps the live canvas through heartbeats and other updates", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "The polling lifecycle is browser independent.",
  );
  test.setTimeout(90000);
  await login(page);
  await page.getByRole("button", { name: "Your crew", exact: true }).click();
  await page.locator('[data-action="office"][data-id="jeff"]').click();
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.evaluate(() => {
    (window as any).officeCanvasBeforePoll = document.querySelector("#world");
  });
  let polls = 0;
  await page.route("**/api/actions", async (route) => {
    const request = route.request();
    if (
      request.method() !== "POST" ||
      JSON.parse(request.postData() || "{}").action !== "get_dashboard"
    ) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const snapshot = await response.json();
    polls++;
    const jeff = snapshot.agents.find((agent: any) => agent.id === "jeff");
    jeff.sequence += polls;
    jeff.lastSeen = new Date().toISOString();
    if (polls > 1)
      snapshot.queue.push({
        id: "poll-update",
        category: "manual",
        text: "A live non-scene update",
        createdAt: new Date().toISOString(),
      });
    await route.fulfill({ response, json: snapshot });
  });
  await expect.poll(() => polls, { timeout: 40000 }).toBeGreaterThanOrEqual(2);
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true");
  expect(
    await page.evaluate(
      () =>
        document.querySelector("#world") ===
        (window as any).officeCanvasBeforePoll,
    ),
  ).toBe(true);
});
test("2D fallback preserves control when WebGL cannot initialize", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (String(kind).includes("webgl")) return null;
      return original.call(this, kind, ...args);
    };
  });
  await login(page);
  await expect(
    page.getByRole("heading", {
      name: "3D unavailable. Your controls are ready.",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "BIS HQ", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Move the team forward." }),
  ).toBeVisible();
});

test("expanded viewer, focus pages and persistent collapsed navigation", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  await login(page);
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect(page.locator(".world-card")).toHaveClass(/expanded-viewer/);
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  const bounds = await page.locator(".world-card").boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.width).toBeGreaterThanOrEqual(viewport.width - 2);
  expect(bounds!.height).toBeGreaterThanOrEqual(viewport.height - 2);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.waitForTimeout(150);
  const rendered = await page.screenshot({
    path: `test-results/${testInfo.project.name}-expanded.png`,
  });
  const visibleModels = await page.evaluate(async (png) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const sample = document.createElement("canvas");
    sample.width = sample.height = 24;
    const context = sample.getContext("2d")!;
    context.drawImage(image, 0, 0, 24, 24);
    const pixels = context.getImageData(0, 0, 24, 24).data;
    let dark = 0;
    for (let y = 8; y < 19; y++)
      for (let x = 6; x < 18; x++) {
        const offset = (y * 24 + x) * 4;
        if (
          Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 170
        )
          dark++;
      }
    return dark;
  }, rendered.toString("base64"));
  expect(
    visibleModels,
    "expanded viewer should contain visible 3D models",
  ).toBeGreaterThan(4);
  await page.getByRole("button", { name: "The War Room", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Jeff’s office", hidden: true }),
  ).toBeAttached();
  await expect(page.locator(".world-card")).toHaveClass(/expanded-viewer/);
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page
    .getByRole("button", { name: "Exit full screen", exact: true })
    .click();
  await expect(page.locator(".world-card")).not.toHaveClass(/expanded-viewer/);
  await page
    .getByRole("button", { name: "Agent details", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Jeff - details" }),
  ).toBeVisible();
  await expect(page.locator("#world")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Runtime & boundaries" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Morning Brief", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Morning Brief", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Today's agenda", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Today's agenda", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Goals", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The bigger picture" }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Collapse navigation", exact: true })
    .click();
  await expect(page.locator("body")).toHaveClass(/nav-collapsed/);
  expect(
    await page.evaluate(() => localStorage.getItem("crew.navCollapsed")),
  ).toBe("true");
  await page
    .getByRole("button", { name: "Expand navigation", exact: true })
    .click();
  await expect(page.locator("body")).not.toHaveClass(/nav-collapsed/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
});
