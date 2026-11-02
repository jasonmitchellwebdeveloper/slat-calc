import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

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
