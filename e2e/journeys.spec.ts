import { expect, test, type Browser, type Page } from "@playwright/test";

// Every interactive path, compared with what the engines say should happen.
// Run `npm run build` first: these drive the static export.
const U = "http://localhost:8124";
const errs: string[] = [];
let b: Browser;

const ok = (c: boolean, n: string, x: unknown = "") => expect.soft(c, `${n} ${x}`).toBeTruthy();
const open = async (url: string, opt: Record<string, unknown> = {}) => {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, ...opt });
  const p = await c.newPage();
  p.on("pageerror", (e) => errs.push(`${url}: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errs.push(`${url}: ${m.text()}`); });
  await p.goto(U + url);
  return p;
};
const cnt = (p: Page, k: string) => p.locator(`[data-c="${k}"] b`).innerText().then(Number);
const stat = (p: Page, k: string) => p.locator(`[data-s="${k}"] b`).innerText().then(Number);
const idle = (p: Page) => p.waitForFunction(() => document.querySelector(".tbtn--main")?.getAttribute("aria-label") === "Play", undefined, { timeout: 30000 });
const sp = (p: Page) => p.getByRole("button", { name: "2×" }).click();

test.beforeEach(({ browser }) => { b = browser; errs.length = 0; });
test.afterEach(() => { expect(errs, "page errors and hydration warnings").toEqual([]); });

test("REDIS", async () => {
const p = await open('/how/topics/redis/');
await p.locator('#stage').scrollIntoViewIfNeeded(); await sp(p); await p.waitForTimeout(500); await idle(p);
ok(await cnt(p,'misses')===1 && await cnt(p,'dbQueries')===1,'A miss');
ok((await p.locator('#strips').innerText()).includes('150 ms'),'A latency');
ok((await p.locator('#keyspace').innerText()).includes('user:42'),'A key stored');
await p.click('#get-42'); await p.waitForTimeout(200);
await p.locator('.pk').first().waitFor({timeout:3000}); 
await idle(p);
ok(await cnt(p,'hits')===1 && await cnt(p,'dbQueries')===1,'B hit no db');
ok((await p.locator('#strips').innerText()).includes('5 ms'),'B latency');
ok((await p.locator('#stage [data-node=db] .node__sub').innerText())==='Not queried','B not queried label');
// pause/step/back
await p.click('#get-42'); await p.waitForTimeout(100); await p.locator('.tbtn--main').click();
const pos1=await p.locator('[data-testid=position]').innerText(); await p.waitForTimeout(900);
ok(pos1===await p.locator('[data-testid=position]').innerText(),'pause holds');
await p.getByRole('button',{name:'Step back'}).click(); const pos2=await p.locator('[data-testid=position]').innerText(); ok(pos1!==pos2,'back moves',pos1+pos2);
await p.getByRole('button',{name:'Step forward'}).click(); await p.waitForTimeout(500);
await p.locator('.tbtn--main').click(); await idle(p);
ok(await cnt(p,'hits')===2,'resume completes');
// keyboard
await p.locator('#stage [data-node=app]').focus(); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(80);
ok(await p.locator('.tbtn--main').getAttribute('aria-label')==='Play','arrow steps');
await p.keyboard.press('Enter'); ok(await p.locator('.bench-inspect').isVisible(),'node inspect via keyboard');
ok((await p.locator('.bench-inspect').innerText()).includes('Application'),'inspector content');
// expiry
await p.click('#clock-60'); await p.waitForTimeout(600); await p.click('#clock-10');await p.waitForTimeout(500);
ok((await p.locator('#keyspace').innerText()).includes('expired'),'ghost row');
await p.click('#get-42'); await idle(p);
ok(await cnt(p,'misses')===2,'expired miss');
// invalidation skip
await p.click('#inval [data-value=none]'); await p.click('#update'); await p.waitForTimeout(200); await idle(p);
await p.click('#get-42'); await idle(p);
ok(await cnt(p,'stale')===1,'stale counted'); ok((await p.locator('#strips').innerText()).includes('stale'),'stale strip');

// failure modes
await p.click('#toggle-redis'); await p.waitForTimeout(600); await p.click('#get-42'); await idle(p);
ok((await p.locator('#strips').innerText()).includes('198 ms'),'bypass 198');
await p.click('#policy [data-value=strict]'); await p.click('#get-42'); await idle(p);
ok(await cnt(p,'failed')===1,'strict failed');
ok((await p.locator('#toggle-redis').innerText())==='Start Redis','toggle label');
await p.click('#reset'); ok(await cnt(p,'requests')===0,'reset');
for(const [t,name,want] of [['hit','hits',1],['expiry','misses',2],['invalidation','stale',1],['failure','dbQueries',2]] as const){
 await p.click(`#tabs [data-value=${t}]`); await p.waitForTimeout(300); await idle(p); ok(await cnt(p,name)===want,'scenario '+t, await cnt(p,name));}
await p.locator('#crowd').scrollIntoViewIfNeeded(); await p.click('#crowd-run'); await p.waitForTimeout(3000);
ok((await p.locator('#crowd [data-node=db] .node__tag').innerText()).startsWith('8'),'stampede 8');
await p.click('#crowd-mode [data-value=lock]'); await p.click('#crowd-run'); await p.waitForTimeout(3000);
ok((await p.locator('#crowd [data-node=db] .node__tag').innerText()).startsWith('1'),'stampede 1');
await p.locator('.opt').nth(1).click(); ok((await p.locator('.challenge__out').innerText()).includes('2 misses'),'challenge from sim');
await p.getByRole('button',{name:'Watch it happen'}).click(); await p.waitForTimeout(600);
ok(await p.locator('#tabs [data-value=expiry]').getAttribute('aria-pressed')==='true','watch runs');
await p.context().close();

});

test("KAFKA", async () => {
const p = await open('/how/topics/apache-kafka/'); await p.locator('#yard').scrollIntoViewIfNeeded(); await sp(p); await p.waitForTimeout(3500);
ok(await stat(p,'delivered')===9,'ordering drains'); ok(await stat(p,'lag')===0,'lag 0');
await p.click('#keys [data-value=off]'); await p.click('#send-10'); await p.waitForTimeout(600);  await p.click('#send-10'); await p.waitForTimeout(6000);
ok(await stat(p,'outOfOrder')>0,'keyless overtakes', await stat(p,'outOfOrder'));
await p.click('#tabs [data-value=scale]'); await p.waitForTimeout(300);
ok(await stat(p,'active')===2,'parallel cap'); ok(await p.locator('.consumer.is-idle').count()===3,'3 idle');
await p.click('#add-part'); await p.waitForTimeout(2500);
ok(await stat(p,'active')===3,'partition adds active', await stat(p,'active')); ok(await stat(p,'generation')===2,'gen');
await p.click('#tabs [data-value=lag]'); await p.waitForTimeout(3500);
ok(await stat(p,'lag')>0,'lag grows'); const lag=await stat(p,'lag');
ok(await p.locator('.consumer.is-paused').count()===1,'paused card');
await p.click('[data-do=resume]'); await p.waitForTimeout(5000); ok(await stat(p,'lag')<lag,'lag closes');
await p.click('#tabs [data-value=crash]'); await p.waitForTimeout(300); 
await p.waitForTimeout(9000); ok(await stat(p,'duplicates')>0,'dups', await stat(p,'duplicates')); ok(await stat(p,'generation')===2,'crash rebalance');
ok(await p.locator('.sink i.is-dup').count()>0,'dup sink');
const ids=await p.locator('.rec').evaluateAll(els=>els.map(e=>(e as HTMLElement).dataset.record)); ok(new Set(ids).size===ids.length,'no duplicate record ids on tapes',ids.join());
const perKey=await p.locator('.tape').evaluateAll(ts=>ts.map(t=>[...new Set([...t.querySelectorAll('.rec')].map(r=>(r as HTMLElement).dataset.record?.[0]))])); ok(new Set(perKey.flat()).size===perKey.flat().length,'a key sits in one partition',JSON.stringify(perKey)); 
await p.click('#tabs [data-value=replay]'); await p.waitForTimeout(400); const d=await stat(p,'delivered');
await p.locator('.tape').first().locator('.rec').first().click(); await p.waitForTimeout(3000); ok(await stat(p,'delivered')>d,'replay by click');
ok((await p.locator('#cli').innerText()).includes('LOG-END-OFFSET'),'cli');
// pause: tick stops; step advances
await p.locator('.tbtn--main').click(); await p.click('#send-10'); await p.waitForTimeout(100); const t1=await p.locator('[data-testid=position]').innerText(); await p.waitForTimeout(800); ok(t1===await p.locator('[data-testid=position]').innerText(),'kafka paused');
await p.getByRole('button',{name:'Step forward'}).click(); await p.waitForTimeout(500); ok(t1!==await p.locator('[data-testid=position]').innerText(),'kafka step');
await p.getByRole('button',{name:'Step back'}).click(); ok(t1===await p.locator('[data-testid=position]').innerText(),'kafka back');
await p.locator('.tbtn--main').click();
await p.locator('[data-do=remove]').first().click(); await p.waitForTimeout(1500); await p.locator('[data-do=remove]').first().click(); await p.waitForTimeout(2500);
ok((await p.locator('.cursor span').first().innerText())==='–','no owner');
await p.click('#fresh-n'); await p.selectOption('#fresh-n','6'); await p.click('#fresh'); await p.waitForTimeout(200); ok(await p.locator('.tape').count()===6,'fresh 6');
await p.locator('#challenge .opt').nth(1).click(); ok((await p.locator('#challenge .challenge__out').innerText()).includes('6 of 8'),'kafka challenge sim', await p.locator('#challenge .challenge__out').innerText());
await p.context().close();

});

test("HOME", async () => {
  let p: Page;
p=await open('/how/'); await p.waitForTimeout(8500);

const s=await p.locator('#hero-strips').innerText(); ok(s.includes('152 ms')&&s.includes('7 ms'),'home miss+hit',s);
await p.click('#hero-wait'); await p.waitForTimeout(500); await p.click('#hero-send'); await p.waitForTimeout(9000);
ok((await p.locator('#hero-strips').innerText()).split('152 ms').length===3,'home expiry miss');
await p.click('[data-node=edge]'); ok((await p.locator('#hero-inspect').innerText()).includes('Nginx'),'home inspect');
await p.fill('#find','agents'); ok(await p.locator('.plate:not(.is-hidden)').count()===1,'search'); ok(await p.locator('.coll[open]').count()>=1,'search opens');
await p.fill('#find','zzz'); ok(await p.locator('#find-none').isVisible(),'none');
await p.fill('#find',''); ok(await p.locator('.plate:not(.is-hidden)').count()===11,'clear');
await p.click('a.plate >> nth=0'); await p.waitForURL('**/how/topics/redis/'); ok(true,'plate link');
await p.click('.mast nav a:last-child'); await p.waitForURL(U+'/'); await p.waitForTimeout(400);
ok(await p.locator('a[href="/how/"]').count()===1,'portfolio link');
ok(await p.evaluate(()=>!!document.getElementById('hero-name')?.querySelector('.ch')),'portfolio js works');
await p.click('[data-scenario=booking]'); await p.waitForTimeout(800); ok((await p.locator('#pg-content').innerText()).includes('booking'),'playground intact');
await p.context().close();
p=await open('/blog.html'); await p.waitForTimeout(500); ok(await p.locator('.opening__title').isVisible(),'scrapbook'); await p.context().close();

});

test("reduced motion", async () => {
let p = await open('/how/topics/redis/',{reducedMotion:'reduce'}); await p.locator('#stage').scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
ok(await p.locator('.pk').count()>0 && await p.locator('.js-in').count()===0,'rm packet static');
const rm1=await p.locator('.pk').first().getAttribute('transform'); await p.waitForTimeout(300); ok(rm1===await p.locator('.pk').first().getAttribute('transform'),'rm no travel');
await p.getByRole('button',{name:'2×'}).click(); await idle(p); ok(await cnt(p,'misses')===1,'rm completes');
ok((await p.locator('#status').textContent())!.length>0,'status text');
await p.context().close();
// offscreen: no frames when hidden
p=await open('/how/topics/apache-kafka/'); await p.locator('#yard').scrollIntoViewIfNeeded(); await p.waitForTimeout(1200); await p.click('#auto [data-value=on]'); await p.waitForTimeout(800);
await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight)); await p.waitForTimeout(600); const a=await p.locator('[data-testid=position]').textContent(); await p.waitForTimeout(1200); ok(a===await p.locator('[data-testid=position]').textContent(),'suspends offscreen');
await p.context().close();
});

test("routes work by direct entry, refresh and history", async () => {
  const p = await open("/how/topics/redis/");
  await expect(p).toHaveTitle("Redis · How Things Work — Ayush Oli");
  await p.reload();
  await expect(p.locator("#title")).toContainText("5 ms");
  await p.goto(`${U}/how/topics/apache-kafka/`);
  await expect(p).toHaveTitle(/Apache Kafka/);
  await p.getByRole("link", { name: "How Things Work" }).first().click();
  await expect(p).toHaveURL(`${U}/how/`);
  await p.goBack();
  await expect(p).toHaveURL(`${U}/how/topics/apache-kafka/`);
  await expect(p.locator("#yard")).toBeVisible();
  await p.goForward();
  await expect(p.locator("#hero")).toBeVisible();
  await p.context().close();
});

test("planned topics are honest and unknown ones are not found", async () => {
  const p = await open("/how/topics/docker/");
  await expect(p.locator("body")).toContainText("hasn't been built yet");
  await expect(p.locator("#bench")).toHaveCount(0);
  const missing = await p.goto(`${U}/how/topics/nope/`);
  expect(missing?.status()).toBe(404);
  await expect(p.locator("body")).toContainText("We haven't drawn this one.");
  await p.context().close();
  errs.length = 0;   // the browser logs the 404 itself
});

test("old URLs redirect to the new ones", async () => {
  const p = await open("/how/redis/");
  await expect(p).toHaveURL(`${U}/how/topics/redis/`);
  await p.goto(`${U}/how/kafka/`);
  await expect(p).toHaveURL(`${U}/how/topics/apache-kafka/`);
  await p.context().close();
});

test("static HTML carries the content before any script runs", async ({ request }) => {
  const html = await (await request.get(`${U}/how/topics/redis/`)).text();
  expect(html).toContain("The cache is a decision in your code");
  expect(html).toContain("GET user:42");
});

for (const [width, height] of [[390, 844], [820, 1100], [1440, 900]] as const) {
  test(`no horizontal overflow at ${width}px`, async () => {
    for (const url of ["/how/", "/how/topics/redis/", "/how/topics/apache-kafka/"]) {
      const p = await open(url, { viewport: { width, height } });
      await p.waitForTimeout(600);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, url).toBe(0);
      await p.context().close();
    }
  });
}
