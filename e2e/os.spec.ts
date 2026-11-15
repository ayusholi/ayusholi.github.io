import { expect, test, type Page } from "@playwright/test";

// AYUSH.OS at /interactive/: apps, deep links, keyboard, terminal, discoveries,
// and the phone layout. Plus the homepage card that leads into it.
const watch = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text()); });
  return errors;
};

test("os: desktop, apps and keyboard", async ({ page }) => {
  const errors = watch(page);
  await page.goto("/interactive/");
  await expect(page.locator("#ident-name")).toContainText("Ayush Oli");
  await expect(page.locator(".tile")).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);

  await page.keyboard.press("1");
  await expect(page.locator("#win-career")).toBeVisible();
  await expect(page).toHaveURL(/#career$/);
  await page.locator(".tl__bar", { hasText: "Fusemachines" }).click();
  await expect(page.locator(".detail__title")).toHaveText("Fusemachines");
  await expect(page.locator(".steps li")).toHaveCount(2);
  await expect(page).toHaveURL(/#career\/fusemachines$/);

  await page.locator(".toggle", { hasText: "Side quests" }).click();
  await expect(page.locator(".tl__lane[data-lane='side'] .tl__bar")).toHaveCount(3);

  await page.locator(".chip--project", { hasText: "Broadway" }).click();
  await expect(page.locator("#win-projects .detail__title")).toHaveText("Broadway Licensing");

  await page.keyboard.press("Escape");
  await expect(page.locator("#win-projects")).toHaveCount(0);
  await expect(page.locator("#win-career")).toBeVisible();
  expect(errors).toEqual([]);
});

test("os: deep link into the stack map shows only stated links", async ({ page }) => {
  await page.goto("/interactive/#stack/go");
  await expect(page.locator("#win-stack")).toBeVisible();
  await expect(page.locator(".target[data-lit]")).toHaveCount(1);
  await expect(page.locator(".target[data-lit]")).toContainText("Excitation");
  await expect(page.locator(".smap__wire")).toHaveCount(1);
  await page.locator(".chip--tech", { hasText: "Kafka" }).click();
  await expect(page.locator(".trace-panel")).toContainText("toolkit");
});

test("os: terminal, discoveries and persistence", async ({ page }) => {
  const errors = watch(page);
  await page.goto("/interactive/");
  await page.keyboard.press("`");
  await expect(page.locator("#term-input")).toBeFocused();
  await page.keyboard.type("stack rabb");
  await page.keyboard.press("Tab");
  await expect(page.locator("#term-input")).toHaveValue("stack rabbitmq");
  await page.keyboard.press("Enter");
  await expect(page.locator(".term__out")).toContainText("Excitation");
  await page.keyboard.type("sudo hire ayush");
  await page.keyboard.press("Enter");
  await expect(page.locator(".toast", { hasText: "sudo hire ayush" })).toBeVisible();
  await page.keyboard.type("open broadway");
  await page.keyboard.press("Enter");
  await expect(page.locator("#win-projects .detail__title")).toHaveText("Broadway Licensing");

  await page.reload();
  await page.locator(".bar__btn[aria-controls='disc-panel']").click();
  await expect(page.locator(".disc__item[data-found]")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("os: phone layout", async ({ page }) => {
  const errors = watch(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/interactive/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator(".tile", { hasText: "PROJECTS.DB" }).click();
  await expect(page.locator("#win-projects")).toHaveAttribute("data-full", "true");
  await expect(page.locator(".desk")).toBeHidden();
  await page.locator(".row", { hasText: "Excitation" }).click();
  await expect(page.locator(".panes__list")).toBeHidden();
  await page.locator(".panes__back").click();
  await expect(page.locator(".panes__list")).toBeVisible();
  await page.locator(".win__back").click();
  await expect(page.locator(".desk")).toBeVisible();
  expect(errors).toEqual([]);
});

test("homepage: My work leads into AYUSH.OS", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#projects .section__title")).toContainText("My work");
  await expect(page.locator("#projects .project--mini")).toHaveCount(5);
  await page.locator("#projects .project--os .project__link").click();
  await expect(page).toHaveURL(/\/interactive\/$/);
  await expect(page.locator("#ident-name")).toBeVisible();
});
