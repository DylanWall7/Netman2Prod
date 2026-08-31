const COLOR_CLASSES = {
  green: "bg-green-500/20 text-green-400",
  blue: "bg-blue-500/20 text-blue-400",
  amber: "bg-amber-500/20 text-amber-400",
  red: "bg-red-500/20 text-red-400",
  gray: "bg-gray-500/20 text-gray-400",
  purple: "bg-purple-500/20 text-purple-400",
  teal: "bg-teal-500/20 text-teal-400",
};

const GLOW_CLASSES = {
  red: "shadow-[0_0_14px_rgba(248,113,113,0.55)]",
};

export default function Badge({ children, color = "gray", size = "sm" }) {
  if (size === "lg") {
    return (
      <span
        className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider px-2.5 py-1 text-xs tv:px-4 tv:py-1.5 tv:text-xl ${COLOR_CLASSES[color] || COLOR_CLASSES.gray} ${GLOW_CLASSES[color] || ""}`}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COLOR_CLASSES[color] || COLOR_CLASSES.gray}`}
    >
      {children}
    </span>
  );
}
