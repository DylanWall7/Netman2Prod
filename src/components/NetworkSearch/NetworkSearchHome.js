import { Link } from "react-router-dom";

function Tile({ to, title, description, children }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 p-5 rounded-xl bg-gray-800 border border-gray-700
                 hover:border-pink-500/50 hover:shadow-lg hover:shadow-black/30
                 transition-colors duration-200"
    >
      <div className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center bg-gray-700/80 text-gray-300">
        {children}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-gray-100 group-hover:text-white transition-colors">{title}</h4>
        <p className="mt-1 text-xs text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
          {description}
        </p>
      </div>
    </Link>
  );
}

export default function NetworkSearchHome() {
  return (
    <div className="mt-12 px-4">
      <div className="text-center mb-8">
        <h1 className="inline-block text-3xl font-bold leading-tight mb-2 pb-4 relative">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
            Network Search
          </span>
          <span className="absolute bottom-0 left-0 w-full h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500" />
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        <Tile
          to="/device-search"
          title="Detailed Device Search"
          description="Search the network by MAC, name, or any keyword and see matching devices."
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
            <path
              d="M21 21l-4.35-4.35M18 10.5a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Tile>

        <Tile
          to="/device-outputs"
          title="Device Outputs"
          description="Look up a device and review its command output history over time."
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
            <path
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Tile>
      </div>
    </div>
  );
}
