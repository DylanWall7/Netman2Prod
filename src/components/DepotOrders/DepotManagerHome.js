import { Link } from "react-router-dom";
import { useMsal } from "@azure/msal-react";

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
        <h4 className="text-sm font-semibold text-gray-100 group-hover:text-white transition-colors">
          {title}
        </h4>
        <p className="mt-1 text-xs text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
          {description}
        </p>
      </div>
    </Link>
  );
}

export default function DepotManagerHome() {
  const { accounts } = useMsal();
  const roles = accounts[0]?.idTokenClaims?.roles || [];
  const isEngineer = roles.includes("Engineer");

  return (
    <div className="mt-12 px-4">
      <div className="text-center mb-8">
        <h1 className="inline-block text-3xl font-bold leading-tight mb-2 pb-4 relative">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
            Depot Manager
          </span>
          <span className="absolute bottom-0 left-0 w-full h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500" />
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
        <Tile to="/dashboard" title="Dashboard" description="TV view of active POs, gear returns, and the ticket queue.">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
            <path d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25M21 5.25V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Tile>

        {isEngineer && (
          <Tile to="/manage" title="Manage Orders" description="Update PO/gear status and work the ticket queue.">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
              <path d="M9 12.75l1.5 1.5 3-3.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Tile>
        )}

        {isEngineer && (
          <Tile to="/supplier-orders" title="Supplier Orders" description="Upload the weekly order CSV and review changes.">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
              <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Tile>
        )}
      </div>
    </div>
  );
}
