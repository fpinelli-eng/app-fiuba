// Lets Node (with --experimental-strip-types) load the app's TypeScript modules, which import each
// other without extension ("./exams") as Next.js allows: a relative import that does not resolve
// is retried with ".ts". Import it before importing any module of src/ (dynamically).
import { registerHooks } from "node:module";

if (typeof registerHooks !== "function") throw new Error("Hace falta Node 22.15 o más nuevo (module.registerHooks).");

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});
