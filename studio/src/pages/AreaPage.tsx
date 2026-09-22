import { Result, Typography } from "antd";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { areas } from "../shell/areas";

export function AreaPage() {
  const location = useLocation();
  const auth = useAuth();
  const area = areas.find((candidate) => candidate.path === location.pathname);

  if (area?.adminOnly && auth.user?.role !== "admin") {
    return <Result status="403" title="You do not have access to this area." />;
  }

  return (
    <section>
      <Typography.Title level={2}>{area?.label ?? "Content Studio"}</Typography.Title>
      <Typography.Paragraph type="secondary">
        This area is part of the Studio. Editing screens are added in a later section.
      </Typography.Paragraph>
    </section>
  );
}
