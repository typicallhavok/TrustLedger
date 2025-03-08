"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createDirectory } from "../../lib/ipfs";

interface Case {
  id: string;
  title: string;
  description: string;
  dateCreated: string;
  createdBy: string;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; isAdmin: boolean } | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [newCase, setNewCase] = useState({ title: "", description: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

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
    setCases(storedCases);
  };

  const handleAddCase = async () => {
    if (!newCase.title) return alert("Case title is required");
    setIsLoading(true);

    try {
      const newCaseObj: Case = {
        id: `CASE-${Date.now().toString().slice(-6)}`,
        title: newCase.title,
        description: newCase.description,
        dateCreated: new Date().toISOString(),
        createdBy: user?.email || "Unknown",
      };

      // Create IPFS directory for the case
      const caseDirPath = `/my-files/${newCaseObj.id}`;
      await createDirectory(caseDirPath, user?.email);

      const updatedCases = [...cases, newCaseObj];
      localStorage.setItem("criminalCases", JSON.stringify(updatedCases));
      setCases(updatedCases);
      setNewCase({ title: "", description: "" });
      setIsFormOpen(false);
      
    } catch (error) {
      console.error("Error creating case:", error);
      alert("Failed to create case directory. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaseClick = (caseId: string) => {
    router.push(`/?caseId=${caseId}`);
  };

  const openForm = () => {
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setNewCase({ title: "", description: "" });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white relative">
      {/* Header */}
      <header className="p-6 bg-gray-800">
        <h1 className="text-4xl font-bold text-blue-400 text-center">Criminal Case Management</h1>
      </header>

      {/* Main Content - Case Folders */}
      <main className="p-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {cases.length === 0 ? (
            <div className="col-span-full text-center py-10">
              <p className="text-gray-400 text-lg">No cases available.</p>
              <p className="text-gray-500">Click the + button to create your first case</p>
            </div>
          ) : (
            cases.map((caseItem) => (
              <div 
                key={caseItem.id} 
                className="flex flex-col items-center cursor-pointer transition-transform hover:scale-105"
                onClick={() => handleCaseClick(caseItem.id)}
              >
                <div className="text-6xl mb-2">📁</div>
                <h3 className="text-center font-medium text-sm truncate w-full">{caseItem.title}</h3>
                <p className="text-gray-500 text-xs">ID: {caseItem.id}</p>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Floating Action Button for Creating New Case */}
      <button
        onClick={openForm}
        className="fixed bottom-8 right-8 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-4xl shadow-lg hover:bg-green-600 transition-colors"
      >
        ➕
      </button>

      {/* Modal Form for Creating New Case */}
      {isFormOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-semibold text-green-400 mb-4">Create New Case</h2>
            
            <input
              type="text"
              placeholder="Case Title"
              value={newCase.title}
              onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
              className="w-full p-3 mb-3 bg-gray-700 border border-gray-600 rounded"
            />
            
            <textarea
              placeholder="Case Description"
              value={newCase.description}
              onChange={(e) => setNewCase({ ...newCase, description: e.target.value })}
              className="w-full p-3 mb-4 bg-gray-700 border border-gray-600 rounded min-h-32"
            />
            
            <div className="flex space-x-3">
              <button
                onClick={handleAddCase}
                disabled={isLoading}
                className="flex-1 bg-green-600 px-4 py-3 rounded font-medium hover:bg-green-700"
              >
                {isLoading ? "Creating..." : "Create Case"}
              </button>
              
              <button
                onClick={closeForm}
                className="flex-1 bg-gray-600 px-4 py-3 rounded font-medium hover:bg-gray-700"
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