import type { Measured } from "./diff.mjs";
export declare const WIDTHS: number[];
export declare const VIEWPORT_HEIGHT: number;
export declare const BROWSERS: string[];
export declare const MAX_ATTEMPTS: number;
export declare const MAX_LOADS: number;
/** Installs the in-page guard under Symbol.for("screenshot-parity-guard"): hideAndMeasure(masks, selectors) and remeasure(). */
export declare function installGuard(): void;
export interface PageGuard { hideAndMeasure(maskSelectors: string[], guardSelectors: string[]): { hidden: Record<string, number>; guard: Measured }; remeasure(): Measured }
