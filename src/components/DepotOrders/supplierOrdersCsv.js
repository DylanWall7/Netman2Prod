import Papa from "papaparse";

const HEADER_MAP = {
  "Site ID": { key: "site_id" },
  "Requestor": { key: "requestor" },
  "Quote Number": { key: "Quote_Number" },
  "Kiewit PO": { key: "kiewit_po" },
  "Order Date": { key: "order_date" },
  "Sub-Total $": { key: "sub_total" },
  "Remaining $ Amount": { key: "remaining_amount" },
  "Order Number": { key: "order_number" },
  "PO to Ingram": { key: "po_to_ingram" },
  "ETA for HW": { key: "eta_for_hw" },
  "Tracking Info for Items Shipped": { key: "tracking" },
  "Notes": { key: "notes" },
};

export const PERSISTED_FIELDS = [
  "site_id",
  "requestor",
  "Quote_Number",
  "order_date",
  "sub_total",
  "remaining_amount",
  "order_number",
  "po_to_ingram",
  "eta_for_hw",
  "tracking",
  "notes",
];
const CHANGE_FIELDS = PERSISTED_FIELDS;

export const FIELD_LABELS = {
  site_id: "Site ID",
  requestor: "Requestor",
  Quote_Number: "Quote Number",
  kiewit_po: "Kiewit PO",
  order_date: "Order Date",
  sub_total: "Sub-Total $",
  remaining_amount: "Remaining $ Amount",
  order_number: "Order Number",
  po_to_ingram: "PO to Ingram",
  eta_for_hw: "ETA for HW",
  tracking: "Tracking Info",
  notes: "Notes",
};

const DATE_FIELDS = new Set(["order_date", "eta_for_hw"]);
const CURRENCY_FIELDS = new Set(["sub_total", "remaining_amount"]);

export function isCompleted(notes) {
  return typeof notes === "string" && notes.toLowerCase().includes("complete");
}

function normalizeDate(value) {
  const match = typeof value === "string" && value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return value;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeCurrency(value) {
  if (typeof value !== "string") return value;
  const cleaned = value.replace(/[$,]/g, "").trim();
  return cleaned;
}

function normalizeRow(raw) {
  const row = {};
  for (const [header, value] of Object.entries(raw)) {
    const mapping = HEADER_MAP[header.trim()];
    if (!mapping) continue;
    let val = typeof value === "string" ? value.trim() : value;
    if (DATE_FIELDS.has(mapping.key)) val = normalizeDate(val);
    if (CURRENCY_FIELDS.has(mapping.key)) val = normalizeCurrency(val);
    row[mapping.key] = val;
  }
  return row;
}

function isValidKiewitPO(value) {
  return /^\d+$/.test(value || "");
}

export function parseSupplierOrdersCsv(csvText) {
  const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  return data.map(normalizeRow).filter((row) => isValidKiewitPO(row.kiewit_po));
}

function matchKey(row) {
  return `${row.kiewit_po}||${row.order_date || ""}`;
}

export function computeSupplierOrdersDiff(csvRows, dbRows) {
  const dbByKey = new Map(dbRows.map((r) => [matchKey(r), r]));
  const seen = new Set();
  const newRows = [];
  const updatedRows = [];
  const unchangedRows = [];
  const skippedCompletedRows = [];

  for (const csvRow of csvRows) {
    const key = matchKey(csvRow);
    seen.add(key);
    const existing = dbByKey.get(key);

    if (!existing) {
      if (isCompleted(csvRow.notes)) {
        skippedCompletedRows.push(csvRow);
      } else {
        newRows.push({ csvRow });
      }
      continue;
    }

    const changes = CHANGE_FIELDS.reduce((acc, field) => {
      const from = existing[field] ?? "";
      const to = csvRow[field] ?? "";
      if (from !== to) acc.push({ field, from, to });
      return acc;
    }, []);

    if (changes.length) {
      updatedRows.push({ id: existing.id, csvRow, changes });
    } else {
      unchangedRows.push(csvRow);
    }
  }

  const missingRows = dbRows.filter((r) => !seen.has(matchKey(r)));

  return { newRows, updatedRows, unchangedRows, missingRows, skippedCompletedRows };
}
