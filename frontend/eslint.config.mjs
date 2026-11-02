import { readdirSync } from "node:fs";
import path from "node:path";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

/**
 * Architecture rules. Dependencies point one way:
 *
 *   app  ->  features  ->  components/ui  ->  lib
 *
 * - lib is framework-free helpers and must not import UI, features or app.
 * - components/ui is generic building blocks and must not import features or app.
 * - features never import app, and reach each other only through a feature's public index.ts.
 * - app (routes) reaches features only through their public index.ts.
 * - Every ui component is a folder; other code imports only its index.ts.
 *
 * The feature and component folders are discovered from disk, so a new one is covered the moment
 * it exists and there is no list to forget to update.
 */
const folders = (relative) =>
  readdirSync(path.join(import.meta.dirname, relative), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

const FEATURES = folders("src/features");
const UI_COMPONENTS = folders("src/components/ui");

/** `from` is a folder's internals; only its index.ts may be imported by code in the `targets`. */
const privateInternals = ({ from, targets, message }) =>
  targets.map((target) => ({ target, from, except: ["./index.ts"], message }));

const zones = [
  {
    target: "./src/lib",
    from: ["./src/components", "./src/features", "./src/app"],
    message: "lib is framework-free helpers: it must not import UI, features or app.",
  },
  {
    target: "./src/components",
    from: ["./src/features", "./src/app"],
    message: "components/ui is generic: it must not import features or app.",
  },
  {
    target: "./src/features",
    from: "./src/app",
    message: "Features must not import from app (routes).",
  },
  // Features: other code reaches a feature only through its public API (index.ts).
  ...FEATURES.flatMap((feature) =>
    privateInternals({
      from: `./src/features/${feature}`,
      targets: [
        ...FEATURES.filter((other) => other !== feature).map((o) => `./src/features/${o}`),
        "./src/components",
        "./src/app",
        "./src/styles",
        "./src/test",
      ],
      message: `Import "@/features/${feature}" (its index.ts), not its internal files.`,
    }),
  ),
  // UI components: each is a folder; others import "@/components/ui/<Name>" (its index.ts).
  ...UI_COMPONENTS.flatMap((component) =>
    privateInternals({
      from: `./src/components/ui/${component}`,
      targets: [
        ...UI_COMPONENTS.filter((other) => other !== component).map(
          (o) => `./src/components/ui/${o}`,
        ),
        "./src/features",
        "./src/app",
        "./src/styles",
        "./src/test",
      ],
      message: `Import "@/components/ui/${component}" (its index.ts), not its internal files.`,
    }),
  ),
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "import/no-restricted-paths": ["error", { zones }] },
  },
  globalIgnores([
    ".next/**",
    ".next-*/**",
    "out/**",
    "coverage/**",
    "next-env.d.ts",
    "src/features/market-data/api/schema.d.ts", // generated
  ]),
]);
