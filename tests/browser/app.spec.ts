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
test("city editor remains usable when a dashboard omits city assets", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
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
    delete snapshot.cityAssets;
    await route.fulfill({ response, json: snapshot });
  });
  await login(page);
  await page.getByRole("button", { name: "Edit city" }).click();
  await expect(page.locator("#city-item")).toBeVisible();
  await page.getByRole("button", { name: "Stop editing city" }).click();
  await expect(page.getByRole("button", { name: "Edit city" })).toBeVisible();
});
test("city editor saves a building model and places an asset", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  test.setTimeout(120000);
  page.on("console", (message) => {
    if (message.type() === "error") console.log("browser:", message.text());
  });
  page.on("pageerror", (error) =>
    console.log("browser exception:", error.message),
  );
  await login(page);
  await page.getByRole("button", { name: "Edit city" }).click();
  await page.locator("#city-item").selectOption("building:relay");
  await page.locator("#city-model").selectOption("glass_atrium");
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Right", exact: true }).click();
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.locator("#city-model")).toHaveValue("glass_atrium");
  await page.locator("#city-add-model").selectOption("satellite_dish");
  await page.getByRole("button", { name: "Add campus asset" }).click();
  await expect(page.locator("#city-model")).toHaveValue("satellite_dish");
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
});
test("HQ desks open focused panels and HQ building and room edits persist", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  test.setTimeout(120000);
  await login(page);
  await page.getByRole("button", { name: "Edit city" }).click();
  await expect(page.locator("#city-item")).toHaveValue("hq");
  await page.locator("#city-model").selectOption("office_building");
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.locator("#city-model")).toHaveValue("office_building");
  await page.getByRole("button", { name: "Stop editing city" }).click();
  await page.getByRole("button", { name: /BIS HQ/ }).last().click();
  await expect(page.getByRole("button", { name: "Edit HQ" })).toBeVisible();
  await page.getByRole("button", { name: "Live ops" }).click();
  await expect(page.getByRole("heading", { name: "Event log" })).toBeVisible();
  await expect(page.locator(".hq-event-log")).toHaveCSS("overflow-y", "auto");
  await page.getByRole("button", { name: "Edit HQ" }).click();
  await page.locator("#hq-zone-item").selectOption("missions");
  await page.getByRole("button", { name: "Right", exact: true }).click();
  await page.getByRole("button", { name: "Save room" }).click();
  await expect(page.locator("#hq-position-values")).toContainText("0.25");
});
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

test("brief dock, saved view, office preset and budget controls", async ({
  page,
}, testInfo) => {
  const suffix = Date.now();
  const viewName = `Failure watch ${suffix}`;
  const presetName = `Relay studio ${suffix}`;
  const budgetName = `Monthly BIS test ${suffix}`;
  test.skip(
    testInfo.project.name !== "chromium",
    "The owner controls are checked in one desktop browser.",
  );
  test.setTimeout(120000);
  await login(page);
  await page.getByRole("button", { name: "Show brief" }).click();
  await expect(page.locator("#brief-dock")).toBeVisible();
  const handle = page.locator("#brief-dock-handle");
  const before = await page.locator("#brief-dock").boundingBox();
  const bounds = await handle.boundingBox();
  await page.mouse.move(bounds!.x + 40, bounds!.y + 15);
  await page.mouse.down();
  await page.mouse.move(bounds!.x - 45, bounds!.y + 40, { steps: 5 });
  await page.mouse.up();
  const after = await page.locator("#brief-dock").boundingBox();
  expect(after!.x).toBeLessThan(before!.x - 30);
  await page.getByRole("button", { name: "Hide brief" }).click();
  await expect(page.locator("#brief-dock")).toHaveCount(0);

  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await page.getByRole("button", { name: "Failed", exact: true }).click();
  await page.getByRole("button", { name: "Save this view" }).click();
  await page.getByLabel("View name").fill(viewName);
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(
    page.getByRole("button", { name: viewName, exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Your crew", exact: true }).click();
  await page.locator('[data-action="office"][data-id="relay"]').click();
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Design office" }).click();
  await page.locator("#preset-name").fill(presetName);
  await page.locator("#save-preset").click();
  await expect(page.locator("#design-status")).toHaveText(
    "Layout saved for every office.",
  );
  await expect(page.locator('select[name="preset"]')).toContainText(presetName);
  await page
    .locator("dialog")
    .evaluate((dialog: HTMLDialogElement) => dialog.close());

  await page
    .getByRole("button", { name: "Settings and credits" })
    .first()
    .click();
  await page.getByRole("button", { name: "Add budget" }).click();
  await page.getByLabel("Budget name").fill(budgetName);
  await page.getByLabel("Soft warning").fill("5");
  await page.getByLabel("Hard limit").fill("10");
  await page.getByRole("button", { name: "Create budget" }).click();
  await expect(page.getByText(budgetName)).toBeVisible();
});

test("office position controls persist and existing campus buildings are editable", async ({
  page,
}, testInfo) => {
  test.skip(
    !["chromium", "mobile"].includes(testInfo.project.name),
    "Position editing is checked on desktop and phone.",
  );
  test.setTimeout(120000);
  await login(page);
  await page.getByRole("button", { name: "Your crew", exact: true }).click();
  await page.locator('[data-action="office"][data-id="relay"]').click();
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Edit positions" }).click();
  await page.locator("#position-slot").selectOption("task_chair");
  await page.getByRole("button", { name: "Reset item" }).click();
  await page.getByRole("button", { name: "Right", exact: true }).click();
  await page.getByRole("button", { name: "Up", exact: true }).click();
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await expect(page.locator("#position-values")).toContainText(
    "0.10 / 0.10 / 0.10",
  );
  await page.getByRole("button", { name: "Save positions" }).click();
  await expect(page.locator("#position-slot")).toHaveCount(0);
  await page.reload();
  await login(page);
  await page.getByRole("button", { name: "Your crew", exact: true }).click();
  await page.locator('[data-action="office"][data-id="relay"]').click();
  await page.getByRole("button", { name: "Edit positions" }).click();
  await page.locator("#position-slot").selectOption("task_chair");
  await expect(page.locator("#position-values")).toContainText(
    "0.10 / 0.10 / 0.10",
  );
  await page.getByRole("button", { name: "Stop editing positions" }).click();
  await page.getByRole("button", { name: "Edit building" }).click();
  await page.getByLabel("Building name").fill("Relay Signal Tower");
  await page.getByLabel("Architecture by work type").selectOption("tower");
  await page.getByRole("button", { name: "Save building" }).click();
  await expect(
    page.getByRole("button", { name: "Edit building" }),
  ).toBeVisible();
});

test("project plot becomes construction and finished campus building, then is reusable", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Lifecycle visuals are checked once on desktop.",
  );
  test.setTimeout(150000);
  const name = `Campus project ${Date.now()}`;
  await login(page);
  await page.getByRole("button", { name: "Your crew", exact: true }).click();
  await page.getByRole("button", { name: "Register building" }).click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Kind").selectOption("project_site");
  await page.getByLabel("Architecture by work type").selectOption("lab");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await page.getByRole("button", { name: "The city", exact: true }).click();
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.screenshot({
    path: "test-results/project-planning.png",
    fullPage: true,
  });
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".lifecycle-panel")).toContainText("Planning");
  await page.getByRole("button", { name: "Start construction" }).click();
  await page
    .getByLabel("Owner decision or evidence")
    .fill("Construction approved");
  await page.getByRole("button", { name: "Update project state" }).click();
  await expect(page.locator(".lifecycle-panel")).toContainText("Building");
  await page.getByRole("button", { name: "The city", exact: true }).click();
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.screenshot({
    path: "test-results/project-building.png",
    fullPage: true,
  });
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Open for work" }).click();
  await page.getByLabel("Owner decision or evidence").fill("Building opened");
  await page.getByRole("button", { name: "Update project state" }).click();
  await expect(page.locator(".lifecycle-panel")).toContainText("Running");
  await page.getByRole("button", { name: "The city", exact: true }).click();
  await expect(page.locator("#world")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  await page.screenshot({
    path: "test-results/project-running.png",
    fullPage: true,
  });
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Mark complete" }).click();
  await page.getByLabel("Owner decision or evidence").fill("Project delivered");
  await page.getByRole("button", { name: "Update project state" }).click();
  await expect(page.locator(".lifecycle-panel")).toContainText("Complete");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Retire project" }).click();
  await expect(
    page.getByRole("heading", { name: "Ready for next project." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start a project here" }).click();
  await page.getByLabel("Name", { exact: true }).fill(`Next ${name}`);
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await page.getByRole("button", { name: "The city", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Next ${name}`, exact: true }),
  ).toBeVisible();
});
