export interface Box { x: number; y: number; width: number; height: number }
export interface ImageRecord { kind: string; element: string; src: string; box: Box; aspect: number | null; natural?: { width: number; height: number } | null; thumb: number[] | null }
export interface ImageScore { index: number; element: string; oldSrc: string; newSrc: string; similarity: number | null }
export interface RegisterEntry { id: string; pairs: { old: string; new: string }[]; widths: number[]; browsers: string[]; selectors: string[]; reason: string }
export interface Register { description?: string; differences: RegisterEntry[] }
export declare const BOX_TOLERANCE: number;
export declare const ASPECT_TOLERANCE: number;
export declare function comparePng(left: Buffer, right: Buffer, options?: { pixelmatchThreshold?: number; ignoreRects?: Box[] }): {
  differentPixels: number | null; sizeMismatch: boolean; width: number; height: number; otherWidth?: number; otherHeight?: number; diff: Buffer | null;
};
export declare function sameShape(oldAspect: number, after: ImageRecord): boolean;
export declare function imageSimilarity(a: number[] | null, b: number[] | null): number | null;
export declare function compareImages(oldImages: ImageRecord[], newImages: ImageRecord[]): { problems: string[]; scores: ImageScore[] };
export declare function wholeCaptureReason(selector: string): string | null;
export declare function readRegister(raw: string, browsers?: string[]): Register;
export declare function entriesFor(register: Register, capture: { old: string; new: string; width: number; browser: string }): RegisterEntry[];
export declare function staleSelectors(entries: RegisterEntry[], oldHidden: Record<string, number> | undefined, newHidden: Record<string, number> | undefined): string[];
export declare function absentPages(sectionRegisterRaw: string): Set<string>;
