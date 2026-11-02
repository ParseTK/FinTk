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
 */
const FEATURES = ["appearance", "home", "market-data", "portfolio", "search", "shell"];

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
  // Other code reaches a feature only through its public API (index.ts).
  ...FEATURES.flatMap((feature) => {
    const message = `Import "@/features/${feature}" (its index.ts), not its internal files.`;
    const others = FEATURES.filter((other) => other !== feature);
    return [
      ...others.map((other) => ({
        target: `./src/features/${other}`,
        from: `./src/features/${feature}`,
        except: ["./index.ts"],
        message,
      })),
      ...["./src/app", "./src/styles", "./src/test"].map((target) => ({
        target,
        from: `./src/features/${feature}`,
        except: ["./index.ts"],
        message,
      })),
    ];
  }),
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "import/no-restricted-paths": ["error", { zones }] },
  },
  globalIgnores([".next/**", ".next-*/**", "out/**", "coverage/**", "next-env.d.ts"]),
]);
