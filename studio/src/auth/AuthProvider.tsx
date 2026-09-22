import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { sessionQueryKey } from "../queryClient";
import { signIn, signOut, restoreSession, type StudioUser } from "./session";

type AuthContextValue = {
  user: StudioUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const session = useQuery({
    queryKey: sessionQueryKey,
    queryFn: restoreSession,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const signInMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => signIn(email, password),
    onSuccess: (user) => {
      client.setQueryData(sessionQueryKey, user);
    },
  });
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      client.setQueryData(sessionQueryKey, null);
    },
  });

  const value: AuthContextValue = {
    user: session.data ?? null,
    ready: session.isFetched,
    signIn: async (email, password) => {
      await signInMutation.mutateAsync({ email, password });
    },
    signOut: async () => {
      await signOutMutation.mutateAsync();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return value;
}
