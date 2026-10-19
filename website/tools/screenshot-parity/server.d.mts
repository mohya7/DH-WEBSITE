import type { Server } from "node:http";
export declare function startServer(options: { root: string; port: number; overlay?: { urlPath: string; file: string } | null }): Promise<Server>;
export declare function fileFor(root: string, urlPath: string): string | null;
