export type ThemeChoice = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

export function parseTheme(value: string | null | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveDark(choice: ThemeChoice, systemPrefersDark: boolean): boolean {
  return choice === "dark" || (choice === "system" && systemPrefersDark);
}

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme.
 * Keep it dependency-free and in sync with resolveDark/parseTheme above (covered by a test).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
