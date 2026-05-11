import React from "react";
import { Button } from "@nextui-org/react";

function StatusIcon({ status }) {
  if (status === "pending")
    return <span className="text-xs text-gray-500 w-16 text-right">Pending</span>;
  if (status === "processing")
    return <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />;
  if (status === "success")
    return (
      <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  if (status === "error")
    return (
      <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  return null;
}

export default function BatchQueue({ items, onSubmitAll, onClear, onClearSucceeded, onDelete, isSubmitting, styles, settingsReady }) {
  const pending = items.filter((i) => i.status === "pending" || i.status === "error").length;
  const success = items.filter((i) => i.status === "success").length;

  if (items.length === 0) {
    return (
      <div className="mt-4 border-2 border-dashed border-gray-700 rounded-xl p-5 text-center">
        <p className="text-gray-600 text-sm">No items queued. Scan items above to add them.</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Queue <span className="font-normal text-gray-600">({items.length} item{items.length !== 1 ? "s" : ""})</span>
        </h3>
        <div className="flex items-center gap-3">
          {success > 0 && (
            <button
              onClick={onClearSucceeded}
              disabled={isSubmitting}
              className="text-xs text-green-600 hover:text-green-400 transition-colors disabled:opacity-50"
            >
              Clear Succeeded
            </button>
          )}
          <button
            onClick={onClear}
            disabled={isSubmitting}
            className="text-xs text-red-700 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            Clear All
          </button>
          <Button
            size="sm"
            onPress={onSubmitAll}
            isDisabled={!settingsReady || isSubmitting || pending === 0}
            isLoading={isSubmitting}
            className={`text-white text-xs font-medium px-3 ${styles.modeActiveBg}`}
          >
            Submit All ({pending})
          </Button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 bg-gray-700 rounded-lg">
            <span className="font-mono text-sm text-pink-400 flex-1 truncate">{item.serial}</span>
            {item.message && (
              <span className="text-xs text-gray-500 truncate max-w-[160px]">{item.message}</span>
            )}
            <StatusIcon status={item.status} />
            {item.status !== "processing" && (
              <button
                onClick={() => onDelete(i)}
                disabled={isSubmitting}
                className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30 flex-shrink-0 ml-1"
                title="Remove"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {success > 0 && (
        <p className="mt-2 text-xs text-green-400">{success} of {items.length} succeeded</p>
      )}
    </div>
  );
}
