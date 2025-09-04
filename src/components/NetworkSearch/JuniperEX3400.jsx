import { useEffect, useMemo, useState } from "react";

/**
 * EX3400FrontPanel — photoreal-ish Juniper EX3400 mock using Tailwind + inline SVG.
 * - 48x RJ45 ports in 4 banks
 * - 4x SFP+ uplinks
 * - SYS/ALM/MST/SPD/OK/EN/POE status
 * - Honeycomb vents (SVG pattern), metallic texture (SVG noise), subtle highlights
 * - LED blink + glow
 */
export default function EX3400FrontPanel({ className = "" }) {
  // Randomized blink state
  const [rjLights, setRjLights] = useState(
    Array.from({ length: 48 }, () => Math.random() > 0.6)
  );
  const [sfpLights, setSfpLights] = useState(
    Array.from({ length: 4 }, () => Math.random() > 0.5)
  );
  const statusLabels = useMemo(
    () => ["SYS", "ALM", "MST", "SPD", "OK", "EN", "POE"],
    []
  );
  const [status, setStatus] = useState(
    statusLabels.map(() => Math.random() > 0.5)
  );

  useEffect(() => {
    const t = setInterval(() => {
      setRjLights((prev) => prev.map(() => Math.random() > 0.6));
      setSfpLights((prev) => prev.map(() => Math.random() > 0.5));
      setStatus((prev) => prev.map(() => Math.random() > 0.5));
    }, 900);
    return () => clearInterval(t);
  }, [statusLabels]);

  return (
    <div className={`relative mx-auto w-full max-w-6xl ${className}`}>
      {/* SVG defs for textures & honeycomb */}
      <svg width="0" height="0" className="absolute">
        <defs>
          {/* Honeycomb hex pattern */}
          <pattern
            id="hc"
            width="14"
            height="12.124"
            patternUnits="userSpaceOnUse"
          >
            <polygon
              points="7,0 14,3.031 14,9.093 7,12.124 0,9.093 0,3.031"
              fill="#1f2937"
            />
          </pattern>

          {/* Fine metallic noise */}
          <filter id="metalNoise" x="0" y="0" width="1" height="1">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              seed="2"
              result="noise"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0 0 0.06" />
            </feComponentTransfer>
          </filter>

          {/* Inner shadow (used via mask) */}
          <filter id="innerShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feOffset dx="0" dy="1" />
            <feGaussianBlur stdDeviation="1.5" />
            <feComposite
              operator="out"
              in2="SourceGraphic"
              result="dropShadow"
            />
            <feColorMatrix
              in="dropShadow"
              type="matrix"
              values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 0.65 0"
            />
            <feComposite in="SourceGraphic" />
          </filter>
        </defs>
      </svg>

      {/* CHASSIS */}
      <div className="relative rounded-xl border-4 border-gray-700 bg-gradient-to-b from-gray-800 to-gray-900 p-4 text-white shadow-xl overflow-hidden">
        {/* subtle metallic texture overlay */}
        <svg className="pointer-events-none absolute inset-0" aria-hidden>
          <rect width="100%" height="100%" filter="url(#metalNoise)" />
        </svg>

        {/* Top honeycomb vent */}
        <div className="relative mb-3 h-6 rounded-md border border-gray-700 bg-gray-900">
          <svg
            className="absolute inset-0"
            preserveAspectRatio="none"
            aria-hidden
          >
            <rect width="100%" height="100%" fill="url(#hc)" />
          </svg>
        </div>

        {/* CONTENT ROW */}
        <div className="flex gap-5">
          {/* 48x RJ45 — 4 banks */}
          <div className="grid flex-1 grid-cols-12 gap-2">
            {Array.from({ length: 48 }).map((_, i) => (
              <PortRJ45 key={i} index={i} ledOn={rjLights[i]} />
            ))}
          </div>

          {/* Right control panel */}
          <RightPanel
            sfpLights={sfpLights}
            status={status}
            statusLabels={statusLabels}
          />
        </div>

        {/* Bottom honeycomb vent */}
        <div className="relative mt-3 h-6 rounded-md border border-gray-700 bg-gray-900">
          <svg
            className="absolute inset-0"
            preserveAspectRatio="none"
            aria-hidden
          >
            <rect width="100%" height="100%" fill="url(#hc)" />
          </svg>
        </div>

        {/* top-edge highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/10 via-white/5 to-transparent" />
        {/* bottom-edge reflection */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white/5 to-transparent" />
      </div>
    </div>
  );
}

function PortRJ45({ index, ledOn }) {
  return (
    <div className="flex flex-col items-center">
      {/* RJ45 cage with inner shading */}
      <div className="relative h-10 w-12 rounded-sm border border-gray-600 bg-gradient-to-b from-gray-700 to-gray-900 shadow-md">
        {/* Cage bevel */}
        <div className="absolute inset-0 rounded-sm ring-1 ring-inset ring-gray-500/60" />
        {/* Inner slot */}
        <div className="absolute left-1 right-1 top-1 bottom-2 rounded-[2px] bg-gradient-to-b from-black/90 to-black/60" />
        {/* Contact pins hint */}
        <div className="absolute left-1 right-1 bottom-1 h-1.5 bg-gradient-to-r from-yellow-200/40 via-yellow-100/40 to-yellow-200/40 opacity-60" />
        {/* LED (left) with glow */}
        <div
          className={
            "absolute -left-2 top-1 h-2 w-2 rounded-full " +
            (ledOn
              ? "bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.6)] animate-blink-soft"
              : "bg-gray-700")
          }
        />
      </div>
      {/* Port numbering like Juniper (orange) */}
      <span className="mt-1 text-[10px] font-medium text-orange-400">
        {index + 1}
      </span>
    </div>
  );
}

function RightPanel({ sfpLights, status, statusLabels }) {
  return (
    <div className="flex w-72 shrink-0 flex-col">
      {/* Branding area */}
      <div className="mb-2">
        <div className="text-sm tracking-wide text-gray-200">
          EX3400 <span className="text-red-400">PoE+</span>
        </div>
        <div className="text-[11px] text-gray-300/80">running JUNOS</div>
      </div>

      {/* Small vent above uplinks (like the real grille) */}
      <div className="relative mb-2 h-10 rounded-md border border-gray-700 bg-gray-900">
        <svg
          className="absolute inset-0"
          preserveAspectRatio="none"
          aria-hidden
        >
          <rect width="100%" height="100%" fill="url(#hc)" />
        </svg>
      </div>

      {/* SFP+ Uplinks */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SfpPort key={i} index={i} ledOn={sfpLights[i]} />
        ))}
      </div>

      {/* Slot numbers under uplinks */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="text-center text-[10px] text-orange-400">
            {i + 1}
          </div>
        ))}
      </div>

      {/* Status LEDs block */}
      <div className="mb-4 grid grid-cols-2 gap-x-3 gap-y-1">
        {statusLabels.map((label, idx) => (
          <div
            key={label}
            className="flex items-center gap-2 text-xs text-gray-100"
          >
            <div
              className={
                "h-2 w-2 rounded-full " +
                (status[idx]
                  ? label === "ALM"
                    ? "bg-red-400 shadow-[0_0_6px_2px_rgba(248,113,113,0.55)] animate-blink-soft"
                    : "bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.6)] animate-blink-soft"
                  : "bg-gray-700")
              }
            />
            {label}
          </div>
        ))}
      </div>

      {/* USB + Console section */}
      <div className="flex items-center gap-4">
        {/* USB rectangle */}
        <div className="relative h-5 w-8 rounded-[3px] border border-gray-500 bg-gray-900 shadow-inner">
          <div className="absolute inset-0 rounded-[3px] ring-1 ring-inset ring-gray-400/40" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
        </div>
        {/* Console (round) */}
        <div className="relative h-5 w-5 rounded-full border border-gray-500 bg-gray-900">
          <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-gray-400/40" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-full" />
        </div>
      </div>

      {/* Little dip switches / slots below (stylized) */}
      <div className="mt-4 grid grid-cols-8 gap-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-5 rounded-sm border border-gray-700 bg-gray-900"
          />
        ))}
      </div>
    </div>
  );
}

function SfpPort({ index, ledOn }) {
  return (
    <div className="flex flex-col items-center">
      {/* LED above */}
      <div
        className={
          "mb-1 h-2 w-2 rounded-full " +
          (ledOn
            ? "bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.6)] animate-blink-soft"
            : "bg-gray-700")
        }
      />
      {/* Cage */}
      <div className="relative h-10 w-12 rounded-sm border border-gray-600 bg-gradient-to-b from-gray-700 to-gray-900 shadow">
        {/* front lip */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-b from-white/30 to-transparent" />
        {/* inner opening */}
        <div className="absolute left-1 right-1 top-2 bottom-1 rounded-[2px] bg-black/70" />
        {/* latch hint */}
        <div className="absolute left-1/2 top-1 h-1 w-6 -translate-x-1/2 rounded bg-gray-400/40" />
      </div>
    </div>
  );
}
