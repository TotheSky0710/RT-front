import React, { useState } from "react";

interface LoginFormProps {
  onLogin: (token: string) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      const res = await fetch(`${backendUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        let errorMsg = "Login failed.";
        try {
          const errJson = await res.json();
          errorMsg = errJson.detail || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }
      const data = await res.json();
      if (data.access_token) {
        onLogin(data.access_token);
      } else {
        throw new Error("Token missing in response");
      }
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-w-md w-full mx-auto bg-white shadow-xl border border-blue-100 p-8 rounded-lg mt-6"
    >
      <h2 className="text-2xl font-semibold text-blue-800 mb-2 text-center">
        Login to Resume Tailor
      </h2>
      <div>
        <label
          htmlFor="username"
          className="block text-gray-700 font-semibold mb-1"
        >
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full border border-blue-300 focus:border-blue-600 outline-none px-3 py-2 rounded mb-1 transition text-gray-900 placeholder:text-gray-500"
          autoComplete="username"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block text-gray-700 font-semibold mb-1"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border border-blue-300 focus:border-blue-600 outline-none px-3 py-2 rounded mb-1 transition text-gray-900 placeholder:text-gray-500"
          autoComplete="current-password"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-700 text-white px-4 py-2 rounded font-semibold shadow hover:bg-blue-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? "Logging in..." : "Login"}
      </button>
      {error && (
        <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-3 rounded text-red-900 text-center shadow animate-fade-in">
          <span className="font-bold">Error:</span> {error}
        </div>
      )}
    </form>
  );
};

export default LoginForm;
