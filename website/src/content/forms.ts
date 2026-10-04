export function careersEndpoint(env: Record<string, string | undefined> = process.env): string {
  const endpoint = env.CAREERS_APPLICATION_ENDPOINT?.trim();
  if (!endpoint) throw new Error("Set CAREERS_APPLICATION_ENDPOINT to the Node hiring application's submission endpoint.");
  if (/^\/(?!\/)/.test(endpoint) && !/[\s\\#]/.test(endpoint)) return endpoint;
  try {
    const url = new URL(endpoint);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !url.hash) return endpoint;
  } catch { /* Report the configuration key, never its potentially sensitive value. */ }
  throw new Error("CAREERS_APPLICATION_ENDPOINT must be an absolute http(s) URL or a same-origin path.");
}
