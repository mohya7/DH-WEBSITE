import type { ImageScore } from "./diff.mjs";
export interface ScoredImage extends ImageScore { old: string; width: number; browser: string; similarity: number }
export declare const WORST_IMAGES: number;
export declare function worstImages(results: { old: string; width: number; browser: string; scores?: ImageScore[] }[], count?: number): ScoredImage[];
export declare function writeReport(outDir: string, data: Record<string, unknown>): string;
