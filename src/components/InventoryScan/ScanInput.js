import React, { useState, useRef, useEffect } from "react";

const SERIAL_REGEX = /^[A-Za-z0-9\-]+$/;

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/;

export default function ScanInput({
  mode,
  onScan,
  disabled,
  isSubmitting,
  singleResult,
  onClearResult,
  styles,
  settingsReady,
  duplicateWarning,
}) {
  const [value, setValue] = useState("");
  const [validationError, setValidationError] = useState("");
  const [stripS, setStripS] = useState(true);
  const inputRef = useRef(null);
  const submitRef = useRef(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  useEffect(() => {
    if (!singleResult && !disabled) inputRef.current?.focus();
  }, [singleResult, disabled]);

  const validate = (serial) => {
    if (!serial || serial.length < 12)
      return "Serial number too short (min 12 characters)";
    if (MAC_REGEX.test(serial))
      return "Looks like a MAC address — serial numbers only";
    if (!SERIAL_REGEX.test(serial))
      return "Invalid — alphanumeric and hyphens only";
    return null;
  };

  const submit = (raw) => {
    let serial = raw.trim().toUpperCase();
    if (stripS && serial.startsWith("S") && serial.length > 12) serial = serial.slice(1);
    // Remap shifted number keys (scanner keyboard layout issue: ! = Shift+1, etc.)
    serial = serial.replace(/!/g, "1");
    const error = validate(serial);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError("");
    setValue("");
    onClearResult?.();
    onScan(serial);
  };
  submitRef.current = submit;

  useEffect(() => {
    if (
      mode !== "single" ||
      disabled ||
      !value.trim() ||
      value.trim().length < 12
    )
      return;
    const timer = setTimeout(() => submitRef.current(value), 400);
    return () => clearTimeout(timer);
  }, [value, mode, disabled]);

  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    submit(value);
  };

  return (
    <div className="mt-5">
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
        Scan Serial Number
        {!settingsReady && (
          <span className="ml-2 text-amber-400 normal-case">
            — configure settings above first
          </span>
        )}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setValidationError("");
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          placeholder={
            settingsReady
              ? "Scan or type serial number, then press Enter..."
              : "Set settings above to enable scanning"
          }
          className={`w-full px-3 py-2 text-sm font-mono rounded-xl border-2 transition-all duration-200
            bg-gray-700 text-pink-400 placeholder:text-xs placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-offset-gray-800
            disabled:opacity-40 disabled:cursor-not-allowed
            ${validationError ? "border-red-500 focus:ring-red-500/30" : styles.inputBorder}
          `}
        />
        {isSubmitting && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {validationError && (
        <p className="mt-2 text-sm text-red-400 flex items-center gap-1.5">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {validationError}
        </p>
      )}

      {duplicateWarning && (
        <p className="mt-2 text-sm text-amber-400 flex items-center gap-1.5">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          Already scanned this session — double-check before proceeding
        </p>
      )}

      {singleResult && (
        <div
          className={`mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg ${
            singleResult.status === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {singleResult.status === "success" ? (
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
          <span className="text-sm font-medium">{singleResult.message}</span>
        </div>
      )}

      {!singleResult && settingsReady && (
        <p className="mt-1.5 text-xs text-gray-600">
          {mode === "single"
            ? "Submits automatically after scanning — or press Enter"
            : "Press Enter or scan to add to queue"}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStripS((v) => !v)}
          className={`relative inline-flex h-4 w-7 flex-shrink-0 rounded-full border-2 border-transparent
            transition-colors duration-200 focus:outline-none cursor-pointer
            ${stripS ? "bg-pink-500" : "bg-gray-600"}`}
        >
          <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform duration-200
            ${stripS ? "translate-x-3" : "translate-x-0"}`} />
        </button>
        <span className="text-xs text-gray-500">Strip leading S prefix (scanner)</span>
      </div>
    </div>
  );
}
