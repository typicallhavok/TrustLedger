"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createDirectory } from "../../lib/ipfs";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Case {
  id: string;
  title: string;
  description: string;
  dateCreated: string;
  createdBy: string;
  type: string;
  status: "open" | "closed";
  accessCount: number;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; isAdmin: boolean } | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [newCase, setNewCase] = useState({ title: "", description: "", type: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const COLORS = ['#0088FE', '#FF8042'];

  useEffect(() => {
    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(JSON.parse(currentUser));
      loadCases();
    }
  }, [router]);

  const loadCases = () => {
    const storedCases = JSON.parse(localStorage.getItem("criminalCases") || "[]");
    // Initialize cases with accessCount if not present
    const updatedCases = storedCases.map((c: any )=> ({
      ...c,
      status: c.status || "open",
      accessCount: c.accessCount || 0,
      type: c.type || "Unknown"
    }));
    
    localStorage.setItem("criminalCases", JSON.stringify(updatedCases));
    setCases(updatedCases);
  };

  const handleAddCase = async () => {
    if (!newCase.title) return alert("Case title is required");
    if (!newCase.type) return alert("Case type is required");
    if (!user?.isAdmin) return alert("Only admins can create cases");
    
    setIsLoading(true);

    try {
      const newCaseObj: Case = {
        id: `CASE-${Date.now().toString().slice(-6)}`,
        title: newCase.title,
        description: newCase.description,
        dateCreated: new Date().toISOString(),
        createdBy: user?.email || "Unknown",
        type: newCase.type,
        status: "open",
        accessCount: 0
      };

      // Create IPFS directory for the case
      const caseDirPath = `/my-files/${newCaseObj.id}`;
      await createDirectory(caseDirPath, user?.email);

      const updatedCases: Case[] = [...cases, newCaseObj];
      localStorage.setItem("criminalCases", JSON.stringify(updatedCases));
      setCases(updatedCases);
      setNewCase({ title: "", description: "", type: "" });
      setIsFormOpen(false);
      
    } catch (error) {
      console.error("Error creating case:", error);
      alert("Failed to create case directory. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaseClick = (caseItem: Case) => {
    // Only proceed if the case is open
    if (caseItem.status === "closed") {
      // For closed cases, just show an alert and don't redirect
      alert("This case is closed and cannot be accessed.");
      return;
    }
    
    // For open cases, increment access count and redirect
    const updatedCases = cases.map(c => {
      if (c.id === caseItem.id) {
        return {...c, accessCount: c.accessCount + 1};
      }
      return c;
    });
    
    localStorage.setItem("criminalCases", JSON.stringify(updatedCases));
    setCases(updatedCases);
    
    router.push(`/?caseId=${caseItem.id}`);
  };

  const handleCaseClose = (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the row click
    
    if (!user?.isAdmin) {
      alert("Only admins can close cases");
      return;
    }
    
    const updatedCases = cases.map(c => {
      if (c.id === caseId) {
        return {...c, status: "closed"};
      }
      return c;
    });
    
    localStorage.setItem("criminalCases", JSON.stringify(updatedCases));
    setCases(updatedCases);
  };

  // New function to reopen closed cases
  const handleCaseReopen = (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the row click
    
    if (!user?.isAdmin) {
      alert("Only admins can reopen cases");
      return;
    }
    
    const updatedCases = cases.map(c => {
      if (c.id === caseId) {
        return {...c, status: "open"};
      }
      return c;
    });
    
    localStorage.setItem("criminalCases", JSON.stringify(updatedCases));
    setCases(updatedCases);
  };

  const openForm = () => {
    if (!user?.isAdmin) {
      alert("Only admins can create cases");
      return;
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setNewCase({ title: "", description: "", type: "" });
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    router.push("/login");
  };

  // Filter cases based on search query
  const filteredCases = cases.filter(caseItem => 
    caseItem.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Prepare data for charts
  const caseStatusData = [
    { name: 'Open', value: cases.filter(c => c.status === "open").length },
    { name: 'Closed', value: cases.filter(c => c.status === "closed").length }
  ];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Generate timeline data for line chart
  const generateTimelineData = () => {
    // Group cases by month/year for the timeline
    const timeMap = new Map();
    
    // Create a date 6 months ago as the starting point
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    
    // Initialize the map with the last 6 months
    for (let i = 0; i < 6; i++) {
      const date = new Date(sixMonthsAgo);
      date.setMonth(date.getMonth() + i);
      const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      timeMap.set(monthYear, { date: monthYear, opened: 0, closed: 0 });
    }
    
    // Populate with actual data
    cases.forEach(caseItem => {
      const caseDate = new Date(caseItem.dateCreated);
      const monthYear = caseDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      // Only count if it's within our 6-month window
      if (timeMap.has(monthYear)) {
        const entry = timeMap.get(monthYear);
        entry.opened++;
        
        // If the case is closed, check if it was closed in this period
        if (caseItem.status === "closed") {
          entry.closed++;
        }
      }
    });
    
    // Convert map to array and sort chronologically
    return Array.from(timeMap.values());
  };

  // Add this function to generate colors for the case type pie chart
  const generateTypeColors = (count) => {
    // Predefined color palette 
    const colorPalette = [
      '#3B82F6', // blue
      '#10B981', // green
      '#F59E0B', // amber
      '#EF4444', // red
      '#8B5CF6', // purple
      '#EC4899', // pink
      '#06B6D4', // cyan
      '#F97316', // orange
      '#6366F1', // indigo
      '#A855F7'  // violet
    ];
    
    // Return colors from palette, or generate if we need more
    return Array(count).fill(0).map((_, index) => {
      if (index < colorPalette.length) {
        return colorPalette[index];
      }
      // Generate a random color if we run out of predefined colors
      return `#${Math.floor(Math.random()*16777215).toString(16)}`;
    });
  };

  // Prepare case type pie chart data
  const caseTypePieData = () => {
    const typeMap = new Map();
    
    cases.forEach(c => {
      if (!typeMap.has(c.type)) {
        typeMap.set(c.type, 0);
      }
      typeMap.set(c.type, typeMap.get(c.type) + 1);
    });
    
    return Array.from(typeMap).map(([type, count]) => ({
      name: type,
      value: count
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Header */}
      <header className="p-6 bg-gradient-to-r from-blue-900 to-purple-900 shadow-lg">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold text-blue-300">Criminal Case Management</h1>
          
          {/* Logout Button */}
          {user && (
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg shadow-md transition-colors"
            >
              Logout
            </button>
          )}
        </div>
        
        {/* Search Bar */}
        <div className="max-w-lg mx-auto relative mt-4">
          <input
            type="text"
            placeholder="Search cases by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-3 pl-10 bg-gray-800 border border-gray-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <span className="absolute left-3 top-3">🔍</span>
        </div>
      </header>

      {/* Main Content - Split View */}
      <main className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side - Cases List */}
        <div className="bg-gray-800 rounded-lg p-4 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-blue-300">Cases</h2>
            {user?.isAdmin && (
              <button
                onClick={openForm}
                className="bg-green-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-500 transition-colors flex items-center shadow-md"
              >
                <span className="mr-1">+</span> New Case
              </button>
            )}
          </div>
          
          <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto px-1">
            {filteredCases.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-400 text-lg">No cases available.</p>
                {user?.isAdmin && (
                  <p className="text-gray-500">Click the + button to create your first case</p>
                )}
              </div>
            ) : (
              filteredCases.map((caseItem) => (
                <div 
                  key={caseItem.id} 
                  className={`${
                    caseItem.status === "closed" 
                      ? "bg-gray-700 opacity-60 cursor-not-allowed" 
                      : "bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 cursor-pointer"
                  } rounded-lg p-5 transition-all transform ${caseItem.status === "open" ? "hover:scale-[1.01]" : ""} relative shadow-md`}
                  onClick={() => handleCaseClick(caseItem)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-xl mb-1">{caseItem.title}</h3>
                      <p className="text-gray-300 text-base mb-3">{caseItem.description}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <p className="text-blue-300">Type: <span className="text-gray-300">{caseItem.type}</span></p>
                        <p className="text-blue-300">ID: <span className="text-gray-300">{caseItem.id}</span></p>
                        <p className="text-blue-300">Created by: <span className="text-gray-300">{caseItem.createdBy}</span></p>
                        <p className="text-blue-300">Date: <span className="text-gray-300">{formatDate(caseItem.dateCreated)}</span></p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        caseItem.status === "open" 
                          ? "bg-green-600 text-green-100" 
                          : "bg-orange-600 text-orange-100"
                      }`}>
                        {caseItem.status.toUpperCase()}
                      </span>
                      
                      {user?.isAdmin && (
                        caseItem.status === "open" ? (
                          <button
                            onClick={(e) => handleCaseClose(caseItem.id, e)}
                            className="mt-3 bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-sm shadow-sm"
                          >
                            Close Case
                          </button>
                        ) : (
                          <button
                            onClick={(e) => handleCaseReopen(caseItem.id, e)}
                            className="mt-3 bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-sm shadow-sm"
                          >
                            Reopen Case
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Right Side - Analytics */}
        <div>
          {/* Analytics Grid - Two Pie Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Pie Chart - Case Status */}
            <div className="bg-gray-800 rounded-lg p-4 shadow-xl">
              <h2 className="text-xl font-semibold text-blue-300 mb-4">Case Status</h2>
              {cases.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={caseStatusData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {caseStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#4ade80' : '#fb923c'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-400">No data available</p>
                </div>
              )}
            </div>
            
            {/* Pie Chart - Case Types */}
            <div className="bg-gray-800 rounded-lg p-4 shadow-xl">
              <h2 className="text-xl font-semibold text-blue-300 mb-4">Case Types</h2>
              {cases.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={caseTypePieData()}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({name, percent}) => 
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {caseTypePieData().map((entry, index) => (
                        <Cell 
                          key={`cell-type-${index}`} 
                          fill={generateTypeColors(caseTypePieData().length)[index]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} cases`, 'Count']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-400">No case type data available</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Line Chart - Case Activity Over Time */}
          <div className="bg-gray-800 rounded-lg p-4 shadow-xl">
            <h2 className="text-xl font-semibold text-blue-300 mb-4">Case Activity Timeline</h2>
            {cases.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={generateTimelineData()}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="opened" 
                    stroke="#4ade80" 
                    strokeWidth={2} 
                    dot={{ r: 4 }} 
                    name="Cases Opened"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="closed" 
                    stroke="#fb923c" 
                    strokeWidth={2} 
                    dot={{ r: 4 }} 
                    name="Cases Closed" 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-400">No timeline data available</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal Form for Creating New Case */}
      {isFormOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
            <h2 className="text-2xl font-semibold text-green-400 mb-4">Create New Case</h2>
            
            <input
              type="text"
              placeholder="Case Title"
              value={newCase.title}
              onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
              className="w-full p-3 mb-4 bg-gray-700 border border-gray-600 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-500"
            />
            
            <textarea
              placeholder="Case Description"
              value={newCase.description}
              onChange={(e) => setNewCase({ ...newCase, description: e.target.value })}
              className="w-full p-3 mb-4 bg-gray-700 border border-gray-600 rounded-lg min-h-32 focus:border-green-500 focus:ring-2 focus:ring-green-500"
            />
            
            <input
              type="text"
              placeholder="Case Type (e.g., Theft, Fraud, Assault)"
              value={newCase.type}
              onChange={(e) => setNewCase({ ...newCase, type: e.target.value })}
              className="w-full p-3 mb-5 bg-gray-700 border border-gray-600 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-500"
            />
            
            <div className="flex space-x-4">
              <button
                onClick={handleAddCase}
                disabled={isLoading}
                className="flex-1 bg-green-600 px-4 py-3 rounded-lg font-medium hover:bg-green-500 transition-colors shadow-md"
              >
                {isLoading ? "Creating..." : "Create Case"}
              </button>
              
              <button
                onClick={closeForm}
                className="flex-1 bg-gray-600 px-4 py-3 rounded-lg font-medium hover:bg-gray-500 transition-colors shadow-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}