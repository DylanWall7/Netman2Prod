// src/pages/SearchPage.jsx
// import { useState } from "react";
// import { devices } from "./data.js";
// import DeviceTable from "./DeviceTable.jsx";

// export default function SearchPage() {
//   const [query, setQuery] = useState("");

//   const filtered = devices.filter((d) =>
//     d.name.toLowerCase().includes(query.toLowerCase())
//   );

//   return (
//     <div className="text-white p-6">
//       <h1 className="text-2xl font-bold mb-4">Network Device Search</h1>
//       <input
//         type="text"
//         placeholder="Search device name..."
//         value={query}
//         onChange={(e) => setQuery(e.target.value)}
//         className="px-4 py-2 rounded-lg w-1/4  text-black border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
//       />

//       <DeviceTable devices={filtered} />
//     </div>
//   );
// }
