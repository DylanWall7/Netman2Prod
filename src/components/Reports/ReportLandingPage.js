import { Link } from "react-router-dom";

export default function ReportLandingPage() {
  const reports = [
    {
      id: 1,
      title: "Opengear Report",
      description: "View Opengear device status and connectivity reports",
      path: "/opengear",
      category: "Infrastructure",
    },
    {
      id: 2,
      title: "System Logs",
      description:
        "View provisioning and system activity logs with time range filtering and search",
      path: "/logs",
      category: "Logs",
    },
  ];

  return (
    <div className="p-6 text-gray-100">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold leading-tight mb-2 pb-4 relative">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-pink-500">
              Network Reports
            </span>
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-1 rounded-full bg-gradient-to-r from-pink-400 to-pink-500"></span>
          </h1>
          <p className="text-sm text-pink-400">
            List of Network Services reports
          </p>
        </div>

        <div className="border-pink-200 border-large rounded-lg overflow-hidden">
          <div className="bg-pink-300 px-6 py-3 border-b border-pink-200">
            <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-pink-400 uppercase tracking-wider">
              <div className="col-span-7">Name</div>

              <div className="col-span-2 text-right">Action</div>
            </div>
          </div>

          <div className="divide-y divide-pink-200">
            {reports.map((report) => (
              <Link key={report.id} to={report.path} className="group block">
                <div className="bg-pink-300 px-6 py-4 hover:bg-pink-700 transition-colors duration-150">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-7">
                      <h3 className="text-base font-semibold text-pink-400 group-hover:text-pink-600 transition-colors mb-1">
                        {report.title}
                      </h3>
                      <p className="text-sm text-pink-400 truncate">
                        {report.description}
                      </p>
                    </div>

                    <div className="col-span-2 flex justify-end">
                      <div className="flex items-center gap-2 text-sm text-pink-400 group-hover:text-pink-600">
                        <span className="font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          Open
                        </span>
                        <svg
                          className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-200"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
