"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createDirectory } from "../../lib/ipfs"; // Update the import path as needed

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
      
    } catch (error) {
      console.error("Error creating case:", error);
      alert("Failed to create case directory. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-6 min-h-screen bg-gray-900 text-white">
      <h1 className="text-4xl font-bold text-blue-400">Criminal Case Management</h1>
      <div className="w-full max-w-4xl bg-gray-800 p-6 rounded-lg shadow-lg mt-6">
        <h2 className="text-2xl font-semibold text-green-400">Add New Case</h2>
        <input
          type="text"
          placeholder="Case Title"
          value={newCase.title}
          onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
          className="w-full p-2 mt-2 bg-gray-700 border border-gray-600 rounded"
        />
        <textarea
          placeholder="Case Description"
          value={newCase.description}
          onChange={(e) => setNewCase({ ...newCase, description: e.target.value })}
          className="w-full p-2 mt-2 bg-gray-700 border border-gray-600 rounded"
        />
        <button
          onClick={handleAddCase}
          disabled={isLoading}
          className="w-full bg-green-600 px-4 py-2 rounded hover:bg-green-700 mt-3"
        >
          {isLoading ? "Adding..." : "Add Case"}
        </button>
      </div>

      <div className="w-full max-w-4xl bg-gray-800 p-6 rounded-lg shadow-lg mt-6">
  <h2 className="text-2xl font-semibold text-blue-400">All Cases</h2>
  {cases.length === 0 ? (
    <p className="text-gray-400 mt-2">No cases available.</p>
  ) : (
    <ul className="mt-4">
      {cases.map((caseItem) => (
        <li key={caseItem.id} className="border-b border-gray-600 p-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">{caseItem.title}</h3>
            <p className="text-gray-400 text-sm">{caseItem.description}</p>
            <p className="text-gray-500 text-xs">Created by: {caseItem.createdBy} on {new Date(caseItem.dateCreated).toLocaleString()}</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => router.push(`/?caseId=${caseItem.id}`)}
              className="bg-blue-500 px-3 py-1 rounded text-sm hover:bg-blue-600"
            >
              Details
            </button>
          </div>
        </li>
      ))}
    </ul>
  )}
</div>
    </div>
  );
}
