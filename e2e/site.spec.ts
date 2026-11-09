import { expect, test } from "@playwright/test";

// The portfolio and Run & Debug, with animation on, plus the links between all
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
  await expect(page.locator("#nav-links a.is-active")).toHaveAttribute("href", "#about");
  await expect(page.locator("#pad-name")).toHaveText("About");


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

test("portfolio: Click button downloads the CV", async ({ page, request }) => {
  await page.goto("/");
  const download = page.locator('.pad a[download]');
  await expect(download).toHaveAttribute("href", "/docs/ayush-oli-cv.pdf");
  const res = await request.get("/docs/ayush-oli-cv.pdf");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("pdf");
});

test("run & debug: reveals and field notes", async ({ page }) => {
  const errors = watch(page);
  await page.goto("/run-and-debug/my-journey/");
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
  await page.locator('a[href="/run-and-debug/my-journey/"]').first().click();
  await expect(page).toHaveTitle("Run & Debug — Ayush Oli");
  await expect(page.locator("body")).toHaveClass("run-debug");
  await page.locator('.masthead a[href="/"]').click();
  await expect(page).toHaveURL(/\/$/);
  await page.locator('#systems a[href="/run-and-debug/how-things-works/"]').click();
  await expect(page).toHaveTitle("How Things Work — Ayush Oli");
  await page.getByRole("link", { name: "← Ayush Oli" }).click();
  await expect(page.locator("#hero-name")).toBeVisible();
  // one stylesheet world per section: Tailwind's reset never reaches the portfolio
  await expect(page.locator("h1").first()).toHaveCSS("font-family", /Space Grotesk/);
});

test("the homepage links to both Run & Debug sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#run-and-debug .card")).toHaveCount(2);
  await expect(page.locator("#run-and-debug .card h3")).toHaveText(["How Things Work"]);
  await page.locator("#run-and-debug .link").first().click();
  await expect(page).toHaveTitle("How Things Work — Ayush Oli");
  await page.goBack();
  await page.locator("#run-and-debug .link").last().click();
  await expect(page).toHaveTitle("Run & Debug — Ayush Oli");
});

test("old URLs and unknown pages", async ({ page }) => {
  await page.goto("/blog.html#notes");
  await expect(page).toHaveURL(/\/run-and-debug\/my-journey\/#notes$/);
  await page.goto("/scrapebook/how-things-works/topics/redis/");
  await expect(page).toHaveURL(/\/run-and-debug\/how-things-works\/topics\/redis\/$/);
  for (const [from, to] of [["/blog/", "my-journey/"], ["/how/", "how-things-works/"], ["/how/topics/redis/", "how-things-works/topics/redis/"]] as const) {
    await page.goto(from);
    await expect(page).toHaveURL(new RegExp(`/run-and-debug/${to}$`));
  }
  const missing = await page.goto("/nope/");
  expect(missing?.status()).toBe(404);
  await expect(page.locator("body")).toContainText("We haven't drawn this one.");
});
