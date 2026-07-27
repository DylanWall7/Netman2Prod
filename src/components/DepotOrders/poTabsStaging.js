import { findExactModelMatch, suggestModelMatches } from "./snipeitModelMatch";

export function isPOTabComplete(orderStatus) {
  return /complete|invoiced/i.test(orderStatus || "");
}

function normalizeProductCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const EXCLUDED_PRODUCT_CODES = new Set(
  ["QFX-QSFP-DAC-3M", "EX-QSFP-40GE-DAC-50CM", "JNP-SFP-25G-DAC-1M", "JNP-100G-DAC-1M"].map(normalizeProductCode),
);

function isExcludedProductCode(productCode) {
  const code = String(productCode || "").trim();
  if (/^sfp/i.test(code)) return true;
  return EXCLUDED_PRODUCT_CODES.has(normalizeProductCode(code));
}

function isRealSerial(serial) {
  return String(serial || "").trim().toLowerCase() !== "n/a";
}

function resolveModelForProductCode(productCode, models) {
  const exact = findExactModelMatch(productCode, models);
  if (exact) return { status: "exact", model: exact, suggestions: [] };
  const suggestions = suggestModelMatches(productCode, models, 5);
  if (suggestions.length === 0) return { status: "none", model: null, suggestions: [] };
  return { status: "suggested", model: null, suggestions };
}

export function buildDeviceStagePlan(poTabResults, models) {
  const activeItems = [];
  const skippedTabs = [];

  for (const tab of poTabResults) {
    if (isPOTabComplete(tab.header.order_status)) {
      skippedTabs.push({ poNumber: tab.poNumber, sheetName: tab.sheetName, orderStatus: tab.header.order_status });
      continue;
    }

    tab.lineItems.forEach((item, lineIndex) => {
      if (isExcludedProductCode(item.product_code)) return;

      const serials = (item.serials || []).filter(isRealSerial);
      if (serials.length === 0) return;

      activeItems.push({
        poNumber: tab.poNumber,
        sheetName: tab.sheetName,
        productCode: item.product_code,
        quantity: item.quantity,
        shipmentStatus: item.shipment_status,
        serials,
        lineIndex,
        modelResolution: resolveModelForProductCode(item.product_code, models),
      });
    });
  }

  return { activeItems, skippedTabs };
}
