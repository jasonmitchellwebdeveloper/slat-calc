import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { compressToEncodedURIComponent } from "lz-string";

const total = (page: Page) => page.locator('[aria-live="polite"]');
const requestQuote = (page: Page) =>
  page.getByRole("button", { name: "Request quote" });

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const summary = violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
  expect(summary).toEqual([]);
}

// Tabs forward only, as a keyboard user would, until the target has focus.
async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 60; presses++) {
    await page.keyboard.press("Tab");
    const focused = await target.evaluate(
      (el) => el === document.activeElement,
    );
    if (focused) return;
  }
  throw new Error(`Tab never reached ${target}`);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("prices the 6000 mm reference run", async ({ page }) => {
  const length = page.getByRole("textbox", { name: "Fence length (mm)" });
  await length.fill("3000");
  await expect(total(page)).not.toContainText("$1,521.85");
  await length.fill("6000");

  await expect(total(page)).toContainText("$1,521.85");
  const results = page.locator("#results");
  await expect(
    results.getByRole("row", { name: /^Slat 65 x 16 mm/ }).getByRole("cell"),
  ).toHaveText(["25", "$39.50", "$987.50"]);
  await expect(
    results.getByRole("row", { name: /^Post 50 x 50 mm/ }).getByRole("cell"),
  ).toHaveText(["5", "$48.00", "$240.00"]);
  await expect(results).toContainText("25 lengths, 0.1% waste");
  await expect(page.getByRole("img")).toHaveAccessibleName(
    "Run 1: 6000 mm, 4 bays, 1795 mm high.",
  );
});

test.describe("accessibility", () => {
  test("has no axe violations when first loaded", async ({ page }) => {
    await expectNoAxeViolations(page);
  });

  test("has no axe violations with a corner run and gate", async ({ page }) => {
    await page.getByRole("button", { name: "Add run" }).click();
    await page.getByLabel("Starts at a corner").check();
    await page.getByLabel("Add gate at the end").nth(1).check();
    await expectNoAxeViolations(page);
  });

  test("has no axe violations showing an error", async ({ page }) => {
    const length = page.getByRole("textbox", { name: "Fence length (mm)" });
    await length.fill("5");
    await length.blur();
    await expect(page.locator("#run-1-length-error")).toBeVisible();
    await expect(length).toHaveAccessibleDescription(/Enter 300 to 50000 mm/);
    await expectNoAxeViolations(page);
  });

  test("has no axe violations with a quote open", async ({ page }) => {
    await requestQuote(page).click();
    await page.getByText("View payload").click();
    await expect(page.locator("#results pre")).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("has no axe violations on a long run that scrolls", async ({ page }) => {
    await page
      .getByRole("textbox", { name: "Fence length (mm)" })
      .fill("50000");
    await expectNoAxeViolations(page);
  });
});

test("a keyboard alone can build a design and request a quote", async ({
  page,
}) => {
  const height = page.getByRole("textbox", { name: "Target height (mm)" });
  await tabTo(page, height);
  await page.keyboard.type("1200");
  await expect(height).toHaveValue("1200");

  // A radio group is one tab stop: Tab reaches the chosen one, arrows move on.
  await tabTo(page, page.getByRole("radio", { name: "Charcoal" }));
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Woodgrain" })).toBeChecked();

  await tabTo(page, page.getByRole("button", { name: "Add run" }));
  await page.keyboard.press("Enter");
  const secondRun = page.locator("#run-2-length");
  await expect(secondRun).toBeFocused();
  await page.keyboard.type("4500");
  await expect(secondRun).toHaveValue("4500");

  await tabTo(page, page.getByLabel("Starts at a corner"));
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Starts at a corner")).toBeChecked();

  await tabTo(page, requestQuote(page));
  await page.keyboard.press("Enter");
  await expect(page.locator("#results [role=status]").first()).toContainText(
    /Quote Q-\d{8}-[0-9A-F]{4} received/,
  );
});

// WCAG 2.2, 2.4.11: the sticky bar must not cover whatever has focus.
test("the focused control is never hidden behind the summary bar", async ({
  page,
}) => {
  const bar = total(page).locator("../..");
  await expect(bar).toHaveCSS("position", "sticky");
  await page.getByRole("button", { name: "Add run" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());

  const covered: string[] = [];
  const visited = new Set<string>();
  for (let presses = 0; presses < 40; presses++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const { top, bottom } = el.getBoundingClientRect();
      return {
        isBody: el === document.body,
        name: el.id || el.textContent || el.tagName,
        inBar: Boolean(el.closest('a[href="#results"]')),
        top,
        bottom,
      };
    });
    if (stop.isBody) continue; // focus has wrapped past the last control
    const barTop = (await bar.boundingBox())!.y;
    visited.add(stop.name);
    if (!stop.inBar && stop.bottom > barTop) covered.push(stop.name);
  }
  expect(visited.size).toBeGreaterThan(10);
  expect(covered).toEqual([]);
});

test("a copied design survives a reload", async ({ page }) => {
  const length = page.getByRole("textbox", { name: "Fence length (mm)" });
  await length.fill("4200");
  await expect(page).toHaveURL(/\?d=/);
  await page.reload();
  await expect(length).toHaveValue("4200");
});

test.describe("3D view", () => {
  const open3d = async (page: Page) => {
    await page.getByRole("radio", { name: "3D view" }).check();
    const canvas = page.getByRole("img", { name: /^Run 1: 6000 mm/ });
    await expect(canvas).toBeVisible();
    return page.locator("canvas");
  };

  test("downloads three.js only when it's chosen", async ({ page }) => {
    const threeLoaded = () => {
      let found = false;
      page.on("response", async (response) => {
        if (!response.url().endsWith(".js")) return;
        const body = await response.text().catch(() => "");
        if (body.includes("WebGLRenderer")) found = true;
      });
      return () => found;
    };
    const wasLoaded = threeLoaded();
    await page.reload();
    await expect(total(page)).toContainText("$1,521.85");
    await page.waitForLoadState("networkidle");
    expect(wasLoaded()).toBe(false);

    await open3d(page);
    await page.waitForLoadState("networkidle");
    await expect.poll(wasLoaded).toBe(true);
  });

  test("draws the fence and redraws it for a new colour", async ({ page }) => {
    const canvas = await open3d(page);
    const charcoal = await canvas.screenshot();
    await page.getByRole("radio", { name: "Woodgrain" }).check();
    const woodgrain = await canvas.screenshot();
    expect(woodgrain.equals(charcoal)).toBe(false);
  });

  test("a keyboard can rotate and reset the view", async ({ page }) => {
    const canvas = await open3d(page);
    const start = await canvas.screenshot();
    const rotateLeft = page.getByRole("button", { name: "Rotate left" });
    await rotateLeft.focus();
    await page.keyboard.press("Enter");
    const rotated = await canvas.screenshot();
    expect(rotated.equals(start)).toBe(false);

    await tabTo(page, page.getByRole("button", { name: "Reset view" }));
    await page.keyboard.press("Enter");
    const reset = await canvas.screenshot();
    expect(reset.equals(rotated)).toBe(false);
  });

  test("lets touch users scroll the page past the canvas", async ({ page }) => {
    const canvas = await open3d(page);
    await expect(canvas).toHaveCSS("touch-action", "pan-y");
  });

  test("has no axe violations", async ({ page }) => {
    await open3d(page);
    await expectNoAxeViolations(page);
  });

  test("switching back and forth raises no errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    for (let i = 0; i < 6; i++) {
      await open3d(page);
      await page.getByRole("radio", { name: "2D plan" }).check();
      await expect(page.locator("canvas")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  test("explains itself when WebGL isn't available", async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null;
    });
    await page.reload();
    await page.getByRole("radio", { name: "3D view" }).check();
    await expect(page.getByText("3D view isn't available")).toBeVisible();
    await page.getByRole("radio", { name: "2D plan" }).check();
    await expect(page.getByRole("img")).toBeVisible();
  });

  test("explains itself when the download fails", async ({ page }) => {
    await page.route(/\.js$/, (route) => route.abort());
    await page.getByRole("radio", { name: "3D view" }).check();
    await expect(page.getByText("3D view isn't available")).toBeVisible();
  });

  test("is left out of the printed plan", async ({ page }) => {
    await open3d(page);
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("canvas")).toBeHidden();
    await expect(page.getByRole("img", { name: /^Run 1/ })).toBeVisible();
  });
});

test.describe("steel panel fence", () => {
  const toPanel = async (page: Page, length = "10000") => {
    await page.getByRole("radio", { name: "Steel panel" }).check();
    await page.locator("#run-1-length").fill(length);
  };
  const row = (page: Page, name: RegExp) =>
    page.locator("#results").getByRole("row", { name }).getByRole("cell");

  test("orders the 10 m reference run", async ({ page }) => {
    await toPanel(page);
    await expect(row(page, /^Sawtooth infill sheet/).first()).toHaveText("13");
    await expect(row(page, /^Channel post/).first()).toHaveText("8");
    await expect(row(page, /^Steel post 50/).first()).toHaveText("2");
    await expect(row(page, /^Panel rail, 2400/).first()).toHaveText("6");
    await expect(row(page, /^Panel rail, 3180/).first()).toHaveText("2");
    await expect(row(page, /^Tek screw/).first()).toHaveText("48");
    await expect(row(page, /^Concrete post mix/).first()).toHaveText("8");
    await expect(page.locator("#results")).toContainText(
      "Run 1, panel 4: cut to 2700 mm",
    );
    await expect(page.getByRole("img")).toHaveAccessibleName(
      "Run 1: 10000 mm, 4 panels, 1800 mm high.",
    );
  });

  test("keeps runs when switching type, and the slat figures return", async ({
    page,
  }) => {
    await toPanel(page, "6000");
    await expect(total(page)).not.toContainText("$1,521.85");
    await page.getByRole("radio", { name: "Aluminium slat" }).check();
    await expect(page.locator("#run-1-length")).toHaveValue("6000");
    await expect(total(page)).toContainText("$1,521.85");
  });

  test("reopens from a link with every option", async ({ page }) => {
    await toPanel(page);
    await page.getByRole("radio", { name: "Aluminium", exact: true }).check();
    await page.getByRole("radio", { name: "1 x sleeper" }).check();
    await page.getByRole("radio", { name: "Trimline" }).check();
    await page.getByRole("radio", { name: "Rapid set" }).check();
    await expect(page).toHaveURL(/\?d=/);
    const before = await total(page).innerText();
    await page.reload();
    await expect(
      page.getByRole("radio", { name: "Steel panel" }),
    ).toBeChecked();
    await expect(page.getByRole("radio", { name: "Trimline" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Rapid set" })).toBeChecked();
    await expect.poll(() => total(page).innerText()).toBe(before);
  });

  test("still opens a link from before fence types existed", async ({
    page,
  }) => {
    const encoded = compressToEncodedURIComponent(
      JSON.stringify({
        targetHeightMm: 1800,
        gapMm: 5,
        slatCount: 25,
        colour: "charcoal",
        mounting: "in-ground",
        runs: [{ id: "run-1", lengthMm: 6000, startsAtCorner: false }],
      }),
    );
    await page.goto(`/?d=${encoded}`);
    await expect(
      page.getByRole("radio", { name: "Aluminium slat" }),
    ).toBeChecked();
    await expect(total(page)).toContainText("$1,521.85");
    await expect(page.getByText("couldn't be read")).toHaveCount(0);
  });

  test("has no axe violations", async ({ page }) => {
    await toPanel(page);
    await expectNoAxeViolations(page);
  });

  test("has no axe violations with a gate, sleepers and 3D", async ({
    page,
  }) => {
    await toPanel(page);
    await page
      .getByRole("radio", { name: "Dressed timber", exact: true })
      .check();
    await page.getByRole("radio", { name: "2 x sleepers" }).check();
    await page.getByLabel("Add gate at the end").check();
    await expectNoAxeViolations(page);
    await page.getByRole("radio", { name: "3D view" }).check();
    await expect(page.locator("canvas")).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("a keyboard alone can request a quote", async ({ page }) => {
    await tabTo(page, page.getByRole("radio", { name: "Aluminium slat" }));
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("radio", { name: "Steel panel" }),
    ).toBeChecked();
    const heights = page.getByRole("group", { name: "Panel height" });
    await tabTo(page, heights.getByRole("radio", { name: "1800 mm" }));
    await page.keyboard.press("ArrowRight");
    await expect(heights.getByRole("radio", { name: "2100 mm" })).toBeChecked();
    await tabTo(page, page.locator("#run-1-length"));
    await page.keyboard.type("7500");
    await tabTo(page, requestQuote(page));
    await page.keyboard.press("Enter");
    await expect(page.locator("#results [role=status]").first()).toContainText(
      /Quote Q-\d{8}-[0-9A-F]{4} received/,
    );
  });

  test("rejects a tampered price", async ({ page }) => {
    await toPanel(page);
    await requestQuote(page).click();
    await page.getByText("View payload").click();
    const payload = JSON.parse(await page.locator("#results pre").innerText());
    const honest = await page.request.post("/api/quote", { data: payload });
    expect(honest.status()).toBe(200);
    payload.totals.incGstCents = 100;
    const tampered = await page.request.post("/api/quote", { data: payload });
    expect(tampered.status()).toBe(422);
  });

  test("posts and rails follow the infill until told otherwise", async ({
    page,
  }) => {
    await toPanel(page);
    const match = page.getByLabel("Posts and rails match the infill");
    const frame = page.getByRole("group", { name: "Posts and rails colour" });
    await expect(match).toBeChecked();
    await expect(frame).toHaveCount(0);
    await page.getByRole("radio", { name: "Off White" }).check();
    await expect(page.locator("#results caption")).toContainText(
      "Off White finish",
    );

    await match.uncheck();
    await expect(frame).toBeVisible();
    await frame.getByRole("radio", { name: "Terracotta" }).check();
    await expect(page.locator("#results caption")).toContainText(
      "Off White infill with Terracotta frame",
    );

    await match.check();
    await expect(frame).toHaveCount(0);
    await expect(page.locator("#results caption")).toContainText(
      "Off White finish",
    );
  });

  test("choosing a sleeper material reveals the quantity", async ({ page }) => {
    await toPanel(page);
    const quantity = page.getByRole("group", {
      name: "Sleeper quantity, per panel",
    });
    await expect(quantity).toHaveCount(0);
    await page.getByRole("radio", { name: "Aluminium", exact: true }).check();
    await expect(quantity).toBeVisible();
    await expect(
      quantity.getByRole("radio", { name: "1 x sleeper" }),
    ).toBeChecked();
    await expect(row(page, /^Aluminium sleeper.*2400/).first()).toHaveText("3");
    await expect(row(page, /^Aluminium sleeper.*3180/).first()).toHaveText("1");
    await expect(row(page, /^Channel post, 2400/).first()).toHaveText("8");
    await expect(row(page, /^Steel post 50 x 50 mm, 3000/).first()).toHaveText(
      "2",
    );

    await quantity.getByRole("radio", { name: "2 x sleepers" }).check();
    await expect(row(page, /^Aluminium sleeper.*2400/).first()).toHaveText("6");

    await page.getByRole("radio", { name: "Undressed timber" }).check();
    await expect(row(page, /^Undressed pine sleeper.*2400/).first()).toHaveText(
      "6",
    );

    await page
      .getByRole("group", { name: "Sleepers", exact: true })
      .getByRole("radio", { name: "None" })
      .check();
    await expect(quantity).toHaveCount(0);
    await expect(page.locator("#results")).not.toContainText("sleeper");
  });

  test("colour swatches work with no visible radio circle", async ({
    page,
  }) => {
    await toPanel(page);
    const swatch = page.getByRole("radio", { name: "Terracotta" });
    await expect(swatch).toHaveCSS("opacity", "0");
    await expect(page.getByRole("radio", { name: "Mist Grey" })).toBeChecked();
    await page.locator("label", { hasText: "Terracotta" }).click();
    await expect(swatch).toBeChecked();
    await page.getByRole("radio", { name: "Terracotta" }).focus();
    await page.keyboard.press("ArrowUp");
    await expect(
      page.getByRole("radio", { name: "Forest Green" }),
    ).toBeChecked();
    await expectNoAxeViolations(page);
  });

  test("short groups sit on one line when there's room", async ({ page }) => {
    const rowsOf = (name: string) =>
      page
        .getByRole("group", { name, exact: true })
        .locator("label")
        .evaluateAll(
          (labels) =>
            new Set(labels.map((l) => l.getBoundingClientRect().top)).size,
        );

    await page.setViewportSize({ width: 1280, height: 900 });
    await toPanel(page);
    expect(await rowsOf("Panel height")).toBe(1);
    expect(await rowsOf("Sleepers")).toBe(1);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect.poll(() => rowsOf("Sleepers")).toBe(2);
    expect(await rowsOf("Panel height")).toBe(1);

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect.poll(() => rowsOf("Panel height")).toBe(2);
  });

  test("no option overflows, at any panel height", async ({ page }) => {
    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await toPanel(page);
      const heights = page.getByRole("group", { name: "Panel height" });
      for (const height of ["1200 mm", "1500 mm", "1800 mm", "2100 mm"]) {
        await heights.getByRole("radio", { name: height }).check();
        const overflowing = await page
          .locator("label:has(input[type=radio])")
          .evaluateAll((labels) =>
            labels
              .filter((l) => l.scrollWidth > l.clientWidth + 1)
              .map((l) => l.textContent),
          );
        expect(overflowing).toEqual([]);
      }
    }
  });

  test("size options fill the card in two columns", async ({ page }) => {
    await toPanel(page);
    const group = page.getByRole("group", { name: "Panel height" });
    const boxes = await group
      .locator("label")
      .evaluateAll((labels) =>
        labels.map((l) => l.getBoundingClientRect().toJSON()),
      );
    expect(boxes).toHaveLength(4);
    expect(boxes[0].y).toBe(boxes[1].y);
    expect(boxes[2].y).toBe(boxes[3].y);
    expect(boxes[0].width).toBe(boxes[1].width);
    const inner = await group.evaluate((g) => g.getBoundingClientRect().width);
    expect(boxes[0].width).toBeGreaterThan(inner * 0.45);
  });

  test("draws in 3D, and redraws for a new frame colour", async ({ page }) => {
    await toPanel(page);
    await page.getByRole("radio", { name: "3D view" }).check();
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    await page.getByLabel("Posts and rails match the infill").uncheck();
    const before = await canvas.screenshot();
    await page.getByRole("radio", { name: "Terracotta" }).nth(1).check();
    const after = await canvas.screenshot();
    expect(after.equals(before)).toBe(false);
  });
});
