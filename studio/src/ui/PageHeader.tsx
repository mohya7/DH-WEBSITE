import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  extra,
}: {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="section-title-row">
      <div>
        <h1>{title}</h1>
        {subtitle !== undefined ? <p>{subtitle}</p> : null}
      </div>
      {extra}
    </div>
  );
}
