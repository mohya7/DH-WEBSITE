import type { Measured } from "./diff.mjs";
export declare const WIDTHS: number[];
export declare const VIEWPORT_HEIGHT: number;
export declare const BROWSERS: string[];
export declare const MAX_ATTEMPTS: number;
export declare const MAX_LOADS: number;
export declare function measureMatches(args: { selectors: string[] }): Measured;
