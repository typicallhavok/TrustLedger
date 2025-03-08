"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!isLogin) {
        // Sign up logic
        if (password !== confirmPassword) {
          throw new Error("Passwords don't match");
        }
        
        // Simulate user storage
        const users = JSON.parse(localStorage.getItem("users") || "[]");
        const userExists = users.find((user: any) => user.email === email);
        
        if (userExists) {
          throw new Error("User already exists");
        }
        
        users.push({
          email,
          password, // In a real app, this should be hashed
          isAdmin: false
        });

        localStorage.setItem("users", JSON.stringify(users));
        setIsLogin(true); // Switch to login view after successful signup
      } else {
        // Login logic
        const users = JSON.parse(localStorage.getItem("users") || "[]");
        const user = users.find((user: any) => user.email === email && user.password === password);
        
        if (!user) {
          throw new Error("Invalid email or password");
        }
        
        // Check admin pin if provided
        const isAdmin = adminPin === "adminAlpha" || user.isAdmin;
        
        // Set user session
        localStorage.setItem("currentUser", JSON.stringify({
          email: user.email,
          isAdmin
        }));
        
        // Redirect to Home Page
        router.push("/home");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-6 min-h-screen bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-6 text-blue-400">IPFS File Storage</h1>
      
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-6 text-center">
          {isLogin ? "Log In" : "Sign Up"}
        </h2>
        
        {error && (
          <div className="bg-red-500 text-white p-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-300 mb-2">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 p-3 rounded"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-300 mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 p-3 rounded"
              required
            />
          </div>
          
          {!isLogin && (
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Confirm Password</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 p-3 rounded"
                required
              />
            </div>
          )}
          
          {isLogin && (
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">
                Admin Access Pin <span className="text-gray-500">(optional)</span>
              </label>
              <input 
                type="password" 
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 p-3 rounded"
              />
            </div>
          )}
          
          <button 
            type="submit"
            disabled={isLoading}
            className={`w-full ${
              isLoading ? 'bg-gray-500' : 'bg-blue-500 hover:bg-blue-600'
            } text-white p-3 rounded transition mt-2`}
          >
            {isLoading ? 'Processing...' : isLogin ? 'Log In' : 'Sign Up'}
          </button>
        </form>
      </div>
    </div>
  );
}
