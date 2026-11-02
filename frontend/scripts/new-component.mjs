#!/usr/bin/env node
/**
 * Creates a new UI component in its own folder with a test and a public index.ts:
 *
 *   npm run new:component -- Tooltip
 *
 * The folder layout is enforced by ESLint (see eslint.config.mjs), so this is the easy way to follow it.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const name = process.argv[2];

if (!name || !/^[A-Z][A-Za-z0-9]*$/.test(name)) {
  console.error("Usage: npm run new:component -- <PascalCaseName>   (for example: Tooltip)");
  process.exit(1);
}

const dir = path.join(import.meta.dirname, "..", "src", "components", "ui", name);
if (existsSync(dir)) {
  console.error(`src/components/ui/${name} already exists.`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

const files = {
  [`${name}.tsx`]: `import clsx from "clsx";
import type { ComponentProps } from "react";

export type ${name}Props = ComponentProps<"div">;

export function ${name}({ className, ...rest }: ${name}Props) {
  return <div className={clsx(className)} {...rest} />;
}
`,
  [`${name}.test.tsx`]: `import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/test/axe";
import { ${name} } from "./${name}";

describe("${name}", () => {
  it("renders its children", () => {
    render(<${name}>Hello</${name}>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<${name}>Hello</${name}>);
    await expectNoA11yViolations(container);
  });
});
`,
  "index.ts": `/** Public API of ${name}. Other code imports only from here. */
export { ${name} } from "./${name}";
export type { ${name}Props } from "./${name}";
`,
};

for (const [file, body] of Object.entries(files)) writeFileSync(path.join(dir, file), body);

console.log(`Created src/components/ui/${name}/ with ${Object.keys(files).join(", ")}.
Next:
  1. Build the component and extend its test (states, keyboard, accessible name).
  2. Add it to the /design gallery (src/app/design/page.tsx) so every state can be reviewed.
  3. Import it elsewhere as "@/components/ui/${name}".`);
