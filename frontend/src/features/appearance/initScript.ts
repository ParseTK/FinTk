/** The script that applies saved preferences before first paint (see PREFERENCES_INIT_SCRIPT). */

/**
 * Runs in <head> before first paint so the page never flashes the wrong look.
 * A plain string literal on purpose: no code is built from values at runtime, so nothing can be
 * injected into it. The ids and storage keys are repeated here, and tests fail if they drift from
 * the constants above.
 */
export const PREFERENCES_INIT_SCRIPT =
  '(function(){var d=document.documentElement;d.classList.add("dark");try{var s=localStorage,t=s.getItem("theme"),a=s.getItem("accent"),f=s.getItem("font"),m=s.getItem("motion");d.classList.toggle("dark",t!=="light");d.dataset.accent=["gold","mint","pink","blue","violet","rose"].indexOf(a)>-1?a:"gold";d.dataset.font=["inter","plex","serif"].indexOf(f)>-1?f:"inter";d.dataset.motion=m==="full"||m==="reduced"?m:(window.matchMedia("(prefers-reduced-motion: reduce)").matches?"reduced":"full")}catch(e){}})()';
