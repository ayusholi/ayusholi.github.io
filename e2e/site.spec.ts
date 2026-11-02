import { expect, test } from "@playwright/test";

// The portfolio and Scrapbook, with animation on, plus the links between all
// three parts of the site.
const watch = (page: import("@playwright/test").Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text()); });
  return errors;
};

test("portfolio: entrance, reveal and theme", async ({ page }) => {
  const errors = watch(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/js-anim/);
  await expect(page.locator("#hero-name")).toHaveClass(/is-done/, { timeout: 4000 });
  await expect(page.locator(".hero__headline")).toHaveClass(/is-in/);
  await expect(page.locator("#year")).toHaveText(String(new Date().getFullYear()));

  await page.locator("#about .about__lead").scrollIntoViewIfNeeded();
  await expect(page.locator("#about .about__lead")).toHaveClass(/is-in/);
  await expect(page.locator("#nav-links a.is-active")).toHaveText("About");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.click("#theme-toggle");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});

test("portfolio: playground and robot", async ({ page }) => {
  const errors = watch(page);
  await page.goto("/");
  await page.locator("#playground").scrollIntoViewIfNeeded();
  await expect(page.locator(".wire")).toHaveCount(9);
  await page.click('[data-node="api"]');
  await expect(page.locator("#pg-content")).toContainText("authentication");
  await page.click("#pg-reset");
  await page.click('[data-scenario="notify"]');
  await expect(page.locator(".pg__steps li")).toHaveCount(4);
  await expect(page.locator(".pg__outro")).toBeVisible({ timeout: 15000 });
  await page.click("#robot-btn");
  await expect(page.locator("#robot-bubble")).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test("portfolio: phone menu and copy button", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors = watch(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.click("#menu-toggle");
  await expect(page.locator("#nav-links")).toHaveClass(/is-open/);
  await page.click('#nav-links a[href="#contact"]');
  await expect(page.locator("#nav-links")).not.toHaveClass(/is-open/);
  await page.click("#copy-email");
  await expect(page.locator(".copy__label")).toHaveText("Copied ✓");
  expect(errors).toEqual([]);
});

test("scrapbook: reveals and field notes", async ({ page }) => {
  const errors = watch(page);
  await page.goto("/scrapebook/my-journey/");
  await expect(page.locator("html")).toHaveClass(/sb-js/);
  await page.locator("#pl-01").scrollIntoViewIfNeeded();
  await expect(page.locator("#pl-01")).toHaveClass(/is-visible/);
  const toggle = page.locator(".note__toggle").first();
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toContainText("Less");
  expect(errors).toEqual([]);
});

test("the three parts of the site link together", async ({ page }) => {
  await page.goto("/");
  await page.locator('a[href="/scrapebook/my-journey/"]').first().click();
  await expect(page).toHaveTitle("The Scrapbook — Ayush Oli");
  await expect(page.locator("body")).toHaveClass("scrapbook");
  await page.locator('.masthead a[href="/"]').click();
  await expect(page).toHaveURL(/\/$/);
  await page.locator('#systems a[href="/scrapebook/how-things-works/"]').click();
  await expect(page).toHaveTitle("How Things Work — Ayush Oli");
  await page.getByRole("link", { name: "← Ayush Oli" }).click();
  await expect(page.locator("#hero-name")).toBeVisible();
  // one stylesheet world per section: Tailwind's reset never reaches the portfolio
  await expect(page.locator("h1").first()).toHaveCSS("font-family", /Space Grotesk/);
});

test("the homepage links to both scrapbook sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#scrapbook .card")).toHaveCount(2);
  await page.locator("#scrapbook .link").first().click();
  await expect(page).toHaveTitle("The Scrapbook — Ayush Oli");
  await page.goBack();
  await page.locator("#scrapbook .link").last().click();
  await expect(page).toHaveTitle("How Things Work — Ayush Oli");
});

test("old URLs and unknown pages", async ({ page }) => {
  await page.goto("/blog.html#notes");
  await expect(page).toHaveURL(/\/scrapebook\/my-journey\/#notes$/);
  for (const [from, to] of [["/blog/", "my-journey/"], ["/how/", "how-things-works/"], ["/how/topics/redis/", "how-things-works/topics/redis/"]] as const) {
    await page.goto(from);
    await expect(page).toHaveURL(new RegExp(`/scrapebook/${to}$`));
  }
  const missing = await page.goto("/nope/");
  expect(missing?.status()).toBe(404);
  await expect(page.locator("body")).toContainText("We haven't drawn this one.");
});
