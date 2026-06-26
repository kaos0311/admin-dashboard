/**
 * Backward-compatible re-export — glass was renamed to surfaces.
 * All imports of `{ glass } from "@/theme"` continue to work.
 */
export { surfaces as glass } from "./surfaces";
export type { SurfaceKey as GlassKey } from "./surfaces";
