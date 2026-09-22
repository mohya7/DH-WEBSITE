import { queryClient, sessionQueryKey } from "../queryClient";

export type StudioUser = {
  id: string;
  email: string;
  role: string;
};

type SessionResponse = {
  accessToken: string;
};

type MeResponse = {
  id: string;
  email: string | null;
  role: string;
};

const channel = new BroadcastChannel("dh-studio-auth");

let accessToken: string | null = null;
let refreshTask: Promise<boolean> | null = null;

channel.onmessage = (message: MessageEvent<string>) => {
  if (message.data === "signed-out") {
    accessToken = null;
    queryClient.setQueryData(sessionQueryKey, null);
    return;
  }

  if (message.data === "signed-in" && accessToken === null) {
    void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
  }
};

export function getAccessToken(): string | null {
  return accessToken;
}

export function readCsrfCookie(): string | null {
  for (const part of document.cookie.split("; ")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }

    if (part.slice(0, separator) === "dh_csrf") {
      return decodeURIComponent(part.slice(separator + 1));
    }
  }

  return null;
}

export async function restoreSession(): Promise<StudioUser | null> {
  if (readCsrfCookie() === null) {
    accessToken = null;
    return null;
  }

  const refreshed = await refreshSession();
  if (!refreshed) {
    return null;
  }

  return readCurrentUser();
}

export async function signIn(email: string, password: string): Promise<StudioUser> {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await readProblem(response));
  }

  const body = (await response.json()) as SessionResponse;
  accessToken = body.accessToken;
  const user = await readCurrentUser();
  if (user === null) {
    accessToken = null;
    throw new Error("Sign-in succeeded, but the session could not be read.");
  }

  channel.postMessage("signed-in");
  return user;
}

export async function signOut(): Promise<void> {
  const csrf = readCsrfCookie();
  if (csrf !== null) {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": csrf },
    });
  }

  accessToken = null;
  channel.postMessage("signed-out");
}

export async function api(input: string, init: RequestInit = {}, retry = false): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken !== null) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status !== 401 || retry || isAuthWrite(input)) {
    return response;
  }

  const refreshed = await refreshSession();
  if (!refreshed) {
    accessToken = null;
    queryClient.setQueryData(sessionQueryKey, null);
    return response;
  }

  return api(input, init, true);
}

async function refreshSession(): Promise<boolean> {
  refreshTask ??= withRefreshLock(performRefresh).finally(() => {
    refreshTask = null;
  });
  return refreshTask;
}

async function performRefresh(): Promise<boolean> {
  const csrf = readCsrfCookie();
  if (csrf === null) {
    accessToken = null;
    return false;
  }

  const response = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": csrf },
  });

  if (!response.ok) {
    accessToken = null;
    return false;
  }

  const body = (await response.json()) as SessionResponse;
  accessToken = body.accessToken;
  return true;
}

async function readCurrentUser(): Promise<StudioUser | null> {
  const response = await api("/api/v1/auth/me");
  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as MeResponse;
  return {
    id: body.id,
    email: body.email ?? "",
    role: body.role,
  };
}

async function readProblem(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { title?: string };
    if (body.title) {
      return body.title;
    }
  } catch {
    return "The request failed.";
  }

  return "The request failed.";
}

function isAuthWrite(input: string): boolean {
  return input.endsWith("/auth/login") || input.endsWith("/auth/refresh") || input.endsWith("/auth/logout");
}

function withRefreshLock<T>(action: () => Promise<T>): Promise<T> {
  if (navigator.locks === undefined) {
    return action();
  }

  return navigator.locks.request("dh-studio-refresh", action) as Promise<T>;
}
