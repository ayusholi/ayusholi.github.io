import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { describe, expect, test } from "vitest";

// The dependency rules, enforced. Each layer may only import from the layers
// listed beside it, so the structure can't quietly decay as topics are added.
//
//   app        routing, metadata and layouts only
//   templates  one page's markup, composed from everything below
//   features   interactive behaviour: engines, simulations, page scripts
//   components reusable presentation with no domain knowledge
//   lib        content, simulation runtime and utilities: depends on nothing above
const SRC = resolve(__dirname);
const RULES: Record<string, string[]> = {
  app: ["app", "templates", "components", "features", "lib", "styles"],
  templates: ["templates", "components", "features", "lib"],
  features: ["features", "components", "lib"],
  components: ["components", "lib"],
  lib: ["lib"],
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const files = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f));
const layerOf = (file: string) => relative(SRC, file).split("/")[0] as string;

const importsOf = (file: string) => {
  const source = readFileSync(file, "utf8");
  // `from "x"`, bare `import "x"`, and `import("x")`
  return [...source.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g)]
    .map((m) => (m[1] ?? m[2] ?? m[3]) as string);
};

const resolveLayer = (file: string, spec: string) => {
  if (spec.startsWith("@/")) return spec.slice(2).split("/")[0];
  if (spec.startsWith(".")) return relative(SRC, resolve(dirname(file), spec)).split("/")[0];
  return null;
};

describe("layers", () => {
  for (const [layer, allowed] of Object.entries(RULES)) {
    test(`${layer} only imports from ${allowed.join(", ")}`, () => {
      const bad = files
        .filter((f) => layerOf(f) === layer)
        .flatMap((f) => importsOf(f).flatMap((spec) => {
          const target = resolveLayer(f, spec);
          return target && !allowed.includes(target) && Object.keys(RULES).includes(target)
            ? [`${relative(SRC, f)} imports ${spec}`] : [];
        }));
      expect(bad).toEqual([]);
    });
  }
});

describe("engines stay pure", () => {
  // Domain logic knows nothing about React, Next or the browser, so it tests without them.
  const engines = files.filter((f) => /\/features\/[^/]+\/[^/]+-(engine|types|content|scenarios)\.ts$/.test(f));

  test("there are engines to check", () => expect(engines.length).toBeGreaterThanOrEqual(8));

  test("they import no React, Next or DOM code", () => {
    const bad = engines.flatMap((f) => importsOf(f)
      .filter((spec) => /^(react|react-dom|next|motion)(\/|$)/.test(spec))
      .map((spec) => `${relative(SRC, f)} imports ${spec}`));
    expect(bad).toEqual([]);
  });

  // Prose like "context window" is fine. Strings with `${…}` are kept, since those run code.
  const code = (f: string) => readFileSync(f, "utf8").replace(/\/\/.*$/gm, "").replace(/"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\$])*`/g, '""');

  test("they don't touch window or document", () => {
    const bad = engines.filter((f) => /\b(window|document|localStorage)\b/.test(code(f)));
    expect(bad.map((f) => relative(SRC, f))).toEqual([]);
  });

  test("they don't read the real clock or random numbers", () => {
    const bad = engines.filter((f) => /\b(Date\.now|new Date|Math\.random|performance\.now)\b/.test(readFileSync(f, "utf8").replace(/\/\/.*$/gm, "")));
    expect(bad.map((f) => relative(SRC, f))).toEqual([]);
  });
});

describe("pages are thin", () => {
  test("every route file in app/ stays small", () => {
    const routes = files.filter((f) => layerOf(f) === "app" && /\/(page|layout|global-not-found)\.tsx$/.test(f));
    const long = routes.map((f) => [relative(SRC, f), readFileSync(f, "utf8").split("\n").length] as const).filter(([, n]) => n > 70);
    expect(long).toEqual([]);
  });
});
