import { Typography } from "antd";
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
    <div className="page-header">
      <div className="page-header-copy">
        <span aria-hidden="true" className="page-header-disk">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <Typography.Title level={2}>{title}</Typography.Title>
          {subtitle !== undefined ? <p className="page-header-sub">{subtitle}</p> : null}
        </div>
      </div>
      {extra}
    </div>
  );
}
