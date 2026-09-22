import { Navigate, createBrowserRouter } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { SignInPage } from "./auth/SignInPage";
import { collectionRoutes } from "./content/model";
import { AuditPage } from "./pages/AuditPage";
import { CollectionListPage } from "./pages/CollectionListPage";
import { ContactInboxPage } from "./pages/ContactInboxPage";
import { ErrorPagesPage } from "./pages/ErrorPagesPage";
import { ItemEditorPage } from "./pages/ItemEditorPage";
import { MediaLibraryPage } from "./pages/MediaLibraryPage";
import { NavigationPage } from "./pages/NavigationPage";
import { RedirectsPage } from "./pages/RedirectsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";
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
          { path: "media", element: <MediaLibraryPage /> },
          ...collectionRoutes.flatMap((route) => [
            { path: route.path, element: <CollectionListPage collection={route.collection} /> },
            { path: `${route.path}/:id`, element: <ItemEditorPage collection={route.collection} /> },
          ]),
          { path: "navigation", element: <NavigationPage /> },
          { path: "redirects", element: <RedirectsPage /> },
          { path: "contact", element: <ContactInboxPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "error-pages", element: <ErrorPagesPage /> },
          { path: "users", element: <UsersPage /> },
          { path: "audit", element: <AuditPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/pages" replace /> },
]);
