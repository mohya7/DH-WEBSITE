import { Navigate, createBrowserRouter } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { SignInPage } from "./auth/SignInPage";
import { AreaPage } from "./pages/AreaPage";
import { areas } from "./shell/areas";
import { AppShell } from "./shell/AppShell";

export const router = createBrowserRouter([
  { path: "/sign-in", element: <SignInPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/pages" replace /> },
          ...areas.map((area) => ({ path: area.path.slice(1), element: <AreaPage /> })),
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/pages" replace /> },
]);
