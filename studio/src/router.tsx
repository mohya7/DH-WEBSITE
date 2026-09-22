import { Navigate, createBrowserRouter } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { SignInPage } from "./auth/SignInPage";
import { collectionRoutes } from "./content/model";
import { AreaPage } from "./pages/AreaPage";
import { CollectionListPage } from "./pages/CollectionListPage";
import { ItemEditorPage } from "./pages/ItemEditorPage";
import { MediaLibraryPage } from "./pages/MediaLibraryPage";
import { areas } from "./shell/areas";
import { AppShell } from "./shell/AppShell";

const editingPaths = new Set([...collectionRoutes.map((route) => route.path), "media"]);

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
          ...areas
            .filter((area) => !editingPaths.has(area.path.slice(1)))
            .map((area) => ({ path: area.path.slice(1), element: <AreaPage /> })),
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/pages" replace /> },
]);
