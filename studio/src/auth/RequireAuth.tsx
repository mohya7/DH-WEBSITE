import { Spin } from "antd";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function RequireAuth() {
  const auth = useAuth();

  if (!auth.ready) {
    return (
      <div className="grid min-h-svh place-items-center">
        <Spin size="large" />
      </div>
    );
  }

  if (auth.user === null) {
    return <Navigate to="/sign-in" replace />;
  }

  return <Outlet />;
}
