const CARRIERS = [
  { key: "ups", match: /ups/i, url: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}` },
  { key: "fedex", match: /fedex/i, url: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}` },
  { key: "saia", match: /saia/i, url: (n) => `https://www.saiasecure.com/tracing/n_manifest.asp?link=y&pro=${encodeURIComponent(n)}` },
];

function carrierFor(label) {
  return CARRIERS.find((c) => c.match.test(label));
}

export function parseTrackingInfo(value) {
  if (!value || typeof value !== "string") return [];
  return value
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .flatMap((segment) => {
      const colonIndex = segment.indexOf(":");
      if (colonIndex === -1) {
        return [{ label: null, carrier: null, number: segment, url: null }];
      }
      const label = segment.slice(0, colonIndex).trim();
      const numbers = segment
        .slice(colonIndex + 1)
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      const carrier = carrierFor(label);
      return numbers.map((number) => ({
        label,
        carrier: carrier?.key || null,
        number,
        url: carrier ? carrier.url(number) : null,
      }));
    });
}
