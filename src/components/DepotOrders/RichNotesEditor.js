import { useEffect, useRef } from "react";

function ToolbarButton({ onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="px-2 py-1 text-xs font-bold rounded bg-gray-800 text-gray-300 hover:bg-gray-600"
    >
      {children}
    </button>
  );
}

export default function RichNotesEditor({ value, onChange, placeholder, rows = 3 }) {
  const ref = useRef(null);
  const isEmpty = !value || value === "<br>";

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = (command) => {
    ref.current?.focus();
    document.execCommand(command, false, null);
    onChange(ref.current?.innerHTML || "");
  };

  return (
    <div className="rounded-lg bg-gray-700 focus-within:ring-2 focus-within:ring-pink-500">
      <div className="flex gap-1 px-2 py-1.5 border-b border-gray-600/60">
        <ToolbarButton title="Bold" onClick={() => exec("bold")}>
          B
        </ToolbarButton>
        <ToolbarButton title="Strikethrough" onClick={() => exec("strikeThrough")}>
          <span style={{ textDecoration: "line-through" }}>S</span>
        </ToolbarButton>
      </div>
      <div className="relative">
        {isEmpty && (
          <span className="absolute left-3 top-2 text-sm text-gray-500 pointer-events-none">{placeholder}</span>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChange(e.currentTarget.innerHTML)}
          style={{ minHeight: `${rows * 1.5}rem` }}
          className="px-3 py-2 text-sm text-gray-100 focus:outline-none whitespace-pre-wrap"
        />
      </div>
    </div>
  );
}
