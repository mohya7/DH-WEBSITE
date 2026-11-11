/*
 * The Studio's pager (ADM-06): antd Pagination with one set of settings for
 * the card and tile screens (ListPager) and the table screens (tablePager).
 * Its colours come from components.Pagination in src/theme.ts.
 */
import { Pagination, type TablePaginationConfig } from "antd";

const shared = {
  // antd offers other page sizes above 50 rows unless this is off.
  showSizeChanger: false,
  // A list with one page looks as it did before paging.
  hideOnSinglePage: true,
  showTotal: (total: number, [from, to]: [number, number]) => `${from}–${to} of ${total}`,
};

/**
 * A pager under a card or tile list. `label` names the navigation landmark; it
 * must not contain "Studio", which the sidebar's landmark is found by.
 */
export function ListPager({
  label,
  current,
  pageSize,
  total,
  onChange,
  size,
}: {
  label: "Inbox pages" | "Media library pages" | "Image picker pages";
  current: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  size?: "small";
}) {
  return (
    <nav aria-label={label} className="mt-4 flex justify-end">
      <Pagination {...shared} current={current} pageSize={pageSize} total={total} onChange={(page) => onChange(page)} size={size} />
    </nav>
  );
}

/** The same settings as a Table's pagination config. */
export function tablePager(current: number, pageSize: number, total: number, onChange: (page: number) => void): TablePaginationConfig {
  return { ...shared, current, pageSize, total, onChange: (page) => onChange(page) };
}
