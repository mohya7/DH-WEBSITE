import { App as AntApp, ConfigProvider } from "antd";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { router } from "./router";
import { queryClient } from "./queryClient";
import { studioTheme } from "./theme";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={studioTheme}>
        <AntApp>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
