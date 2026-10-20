const labels: Record<string, string> = {
  draft: "draft",
  published: "published",
  changed: "changed",
  ended: "ended",
  new: "new",
  handled: "handled",
  admin: "draft",
  editor: "draft",
};

const display: Record<string, string> = {
  ended: "Ended · انتهت",
};

export function StatusChip({ state }: { state: string }) {
  const tone = labels[state] ?? "draft";
  return <span className={`status-chip status-chip--${tone}`}>{display[state] ?? state}</span>;
}
