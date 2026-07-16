import DOMPurify from "dompurify";

const ALLOWED_TAGS = ["b", "strong", "s", "strike", "del", "i", "em", "u", "br", "div"];

export default function RichNotesDisplay({ html, className }) {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS });
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
