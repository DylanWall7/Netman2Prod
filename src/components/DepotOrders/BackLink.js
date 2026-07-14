import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function BackLink() {
  return (
    <Link
      to="/depot-orders"
      className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-pink-400 transition-colors mb-4"
    >
      <ArrowLeftIcon className="w-4 h-4" />
      Back to Depot Manager
    </Link>
  );
}