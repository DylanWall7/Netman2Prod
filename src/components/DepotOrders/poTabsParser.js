import * as XLSX from "xlsx";
import { normalizeDate, normalizeCurrency, parseSupplierOrdersCsv } from "./supplierOrdersCsv";

const PO_TAB_PATTERN = /^PO\s+(\d+)$/i;

const HEADER_FIELD_MAP = {
  "order": "order_number",
  "po": "po_number",
  "pototalamount": "po_total",
  "remainingamount": "remaining_amount",
  "orderdate": "order_date",
  "orderstatus": "order_status",
  "shiptoaddress": "ship_to_address",
};

const LINE_ITEM_HEADER_MAP = {
  "productcode": "product_code",
  "quantity": "quantity",
  "shipmentstatus": "shipment_status",
  "eta": "eta",
  "trackingupdate": "tracking_update",
  "trackinglink": "tracking_link",
  "trackinglinks": "tracking_link",
  "serials": "serials",
  "serialnumbers": "serials",
};

function normalizeLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cellText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function cellDateText(value) {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return normalizeDate(cellText(value));
}

function parseSerials(value) {
  if (value === undefined || value === null) return [];
  return String(value)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isPOTabSheetName(name) {
  return PO_TAB_PATTERN.test(name.trim());
}

function parseHeaderBlock(rows) {
  const header = {};
  let tableStartIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    const rawLabel = cellText(rows[i]?.[0]).replace(/:\s*$/, "");
    if (normalizeLabel(rawLabel) === "productcode") {
      tableStartIndex = i;
      break;
    }
    const key = HEADER_FIELD_MAP[normalizeLabel(rawLabel)];
    if (key) {
      const rawValue = rows[i]?.[1];
      let value = key === "order_date" ? cellDateText(rawValue) : cellText(rawValue);
      if (key === "po_total" || key === "remaining_amount") value = normalizeCurrency(value);
      header[key] = value;
    }
  }

  return { header, tableStartIndex };
}

function findHeaderRowIndices(rows, startIndex) {
  const indices = [];
  for (let i = startIndex; i < rows.length; i++) {
    if (normalizeLabel(cellText(rows[i]?.[0])) === "productcode") indices.push(i);
  }
  return indices;
}

function parseLineItems(rows, firstTableStartIndex) {
  if (firstTableStartIndex === -1) {
    return { lineItems: [], warnings: ["Could not find the 'Product Code' table header in this tab"] };
  }

  const headerIndices = findHeaderRowIndices(rows, firstTableStartIndex);
  const lineItems = [];
  const warnings = [];

  headerIndices.forEach((headerIdx, segIdx) => {
    const headerRow = rows[headerIdx];
    const columnKeys = headerRow.map((cell) => {
      const raw = cellText(cell);
      if (!raw) return null;
      const key = LINE_ITEM_HEADER_MAP[normalizeLabel(raw)];
      if (!key && segIdx === 0) warnings.push(`Unrecognized column header in table: "${raw}"`);
      return key || null;
    });

    const segmentEnd = headerIndices[segIdx + 1] ?? rows.length;

    for (let i = headerIdx + 1; i < segmentEnd; i++) {
      const row = rows[i];
      if (!row || row.every((c) => cellText(c) === "")) continue;

      const item = { serials: [] };
      columnKeys.forEach((key, colIndex) => {
        if (!key) return;
        const raw = row[colIndex];
        if (key === "serials") item[key] = parseSerials(raw);
        else if (key === "eta") item[key] = cellDateText(raw);
        else item[key] = cellText(raw);
      });

      if (!item.product_code) continue;
      if (!item.quantity && !item.shipment_status) continue; // section-title row, not a product line

      const qty = Number(item.quantity);
      if (item.serials.length > 0 && !Number.isNaN(qty) && item.serials.length !== qty) {
        warnings.push(
          `${item.product_code}: quantity is ${item.quantity} but ${item.serials.length} serial number(s) were found`,
        );
      }

      lineItems.push(item);
    }
  });

  return { lineItems, warnings };
}

export function parsePOTabsWorkbook(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const results = [];

  for (const sheetName of workbook.SheetNames) {
    const match = sheetName.trim().match(PO_TAB_PATTERN);
    if (!match) continue;

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    const { header, tableStartIndex } = parseHeaderBlock(rows);
    const { lineItems, warnings } = parseLineItems(rows, tableStartIndex);

    results.push({
      sheetName,
      poNumber: header.po_number || match[1],
      header,
      lineItems,
      warnings,
    });
  }

  return results;
}

export function parseMainSheetFromWorkbook(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const mainSheetName = workbook.SheetNames.find((name) => !isPOTabSheetName(name));
  if (!mainSheetName) return [];

  const csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[mainSheetName], { dateNF: "m/d/yyyy" });
  return parseSupplierOrdersCsv(csvText);
}
