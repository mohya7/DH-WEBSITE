import { careersEndpointError } from "../iis/careers-endpoint";

/** The careers form's endpoint: a same-site path, checked by Section 8's guard, or the build fails. */
export function careersEndpoint(env: Record<string, string | undefined> = process.env): string {
  const endpoint = env.CAREERS_APPLICATION_ENDPOINT?.trim();
  if (!endpoint) throw new Error("Set CAREERS_APPLICATION_ENDPOINT to the Node hiring application's submission endpoint.");
  /* Report the configuration key, never its potentially sensitive value. */
  if (careersEndpointError(endpoint) !== null) {
    throw new Error("CAREERS_APPLICATION_ENDPOINT must be a same-site path starting with /, such as /api/careers/applications. Absolute and off-site URLs are refused.");
  }
  return endpoint;
}
