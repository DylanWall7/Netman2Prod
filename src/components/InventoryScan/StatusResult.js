import React from "react";

function Field({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <span className="text-xs text-gray-500 uppercase tracking-wider">
        {label}
      </span>
      <p className="text-sm text-gray-200 mt-0.5">{value}</p>
    </div>
  );
}

function Counter({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col items-center justify-center px-3 py-2 bg-gray-800 rounded-lg">
      <span className="text-lg font-bold text-gray-100">{value}</span>
      <span className="text-xs text-gray-500 mt-0.5">{label}</span>
    </div>
  );
}

export default function StatusResult({ result, styles, onClear }) {
  if (result.error) {
    return (
      <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
        <svg
          className="w-4 h-4 text-red-400 flex-shrink-0"
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
        <div>
          <p className="text-sm font-medium text-red-400">{result.serial}</p>
          <p className="text-xs text-red-400/70">{result.error}</p>
        </div>
        <button
          onClick={onClear}
          className="ml-auto text-gray-600 hover:text-gray-400 transition-colors"
        >
          <svg
            className="w-4 h-4"
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
        </button>
      </div>
    );
  }

  const d = result.data;

  const statusName = d?.status_label?.name;
  const statusType = d?.status_label?.status_type;
  const statusColor =
    statusType === "deployable"
      ? "text-green-400 bg-green-500/10 border-green-500/20"
      : statusType === "archived"
        ? "text-gray-400 bg-gray-500/10 border-gray-500/20"
        : statusType === "undeployable"
          ? "text-red-400 bg-red-500/10 border-red-500/20"
          : `${styles.accentText} bg-cyan-500/10 border-cyan-500/20`;

  const lastOnline = d?.custom_fields?.last_online?.value;

  return (
    <div className="mt-4 bg-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-600">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`}
          />
          <span className="font-mono text-sm text-pink-400 font-medium truncate">
            {result.serial}
          </span>
          {d?.name && (
            <span className="text-xs text-gray-500 truncate">— {d.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {statusName && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColor}`}
            >
              {statusName}
            </span>
          )}
          <button
            onClick={onClear}
            className="text-gray-600 hover:text-gray-400 transition-colors"
          >
            <svg
              className="w-4 h-4"
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
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 pb-2 grid grid-cols-2 gap-3">
        <Field label="Asset Tag" value={d?.asset_tag} />
        <Field label="Manufacturer" value={d?.manufacturer?.name} />
        <Field label="Model" value={d?.model?.name} />
        <Field label="Model #" value={d?.model_number} />
        <Field label="Category" value={d?.category?.name} />
        <Field
          label="Assigned To"
          value={d?.assigned_to?.name || d?.assigned_to?.username}
        />
        <Field label="Location" value={d?.location?.name} />
        <Field label="RTD Location" value={d?.rtd_location?.name} />
        <Field label="Last Online" value={lastOnline || "No date recorded"} />
        {d?.notes && (
          <div className="col-span-2">
            <Field label="Notes" value={d.notes} />
          </div>
        )}
      </div>

      <div className="px-4 pb-3 grid grid-cols-2 gap-2">
        <Counter label="Check-ins" value={d?.checkin_counter} />
        <Counter label="Check-outs" value={d?.checkout_counter} />
      </div>

      <div className="px-4 pb-3 grid grid-cols-2 gap-3">
        <Field label="Created" value={d?.created_at?.formatted} />
        <Field label="Created By" value={d?.created_by?.name} />
        <Field label="Last Check-in" value={d?.last_checkin?.formatted} />
        <Field label="Last Check-out" value={d?.last_checkout?.formatted} />
      </div>
    </div>
  );
}
