import type { Removed } from "./diff.mjs";
export interface MeasureInput {
  entries: { id: string; selectors?: string[] }[];
  maskedPng: Buffer;
  screenshot(): Promise<Buffer>;
  showAll(): Promise<unknown>;
  hideAll(): Promise<unknown>;
  hideOnly(ids: string[]): Promise<unknown>;
  wait(): Promise<unknown>;
  diff(a: Buffer, b: Buffer): { differentPixels: number | null; sizeMismatch: boolean; width: number; height: number };
  maxAttempts: number;
  entryCap: number;
}
export declare function measureRemoved(input: MeasureInput): Promise<Removed>;
