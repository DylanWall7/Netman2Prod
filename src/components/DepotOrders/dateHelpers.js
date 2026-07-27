export function today() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(iso) {
  if (!iso) return "—";
  const value = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso;
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function daysUntil(iso) {
  if (!iso) return null;
  const diffMs = new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

export function isOverdue(iso) {
  const days = daysUntil(iso);
  return days !== null && days < 0;
}
