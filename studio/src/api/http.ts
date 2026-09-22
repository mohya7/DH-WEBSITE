import { api } from "../auth/session";

export type Problem = {
  code?: string;
  title?: string;
  errors?: Record<string, string[]>;
  warnings?: Record<string, string[]>;
  usages?: string[];
};

export async function request(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: unknown; problem: Problem | null }> {
  const response = await api(path, init);
  const text = await response.text();
  const parsed: unknown = text.length > 0 ? JSON.parse(text) : null;
  if (!response.ok) {
    return { ok: false, status: response.status, body: parsed, problem: (parsed ?? {}) as Problem };
  }

  return { ok: true, status: response.status, body: parsed, problem: null };
}

export function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}
