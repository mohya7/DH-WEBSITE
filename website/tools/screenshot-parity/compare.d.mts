export declare function portFromEnv(name: string, fallback: number, env?: Record<string, string | undefined>): number;
export declare function browsersFromEnv(env?: Record<string, string | undefined>): string[];
export declare function compareSites(options: Record<string, unknown>): Promise<{ results: Record<string, unknown>[]; failed: number; reportPath: string }>;
