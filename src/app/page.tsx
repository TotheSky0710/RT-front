"use client";

import React, { useState, useEffect } from "react";
import JobInputForm from "./JobInputForm";
import LoginForm from "./LoginForm";

export default function Home() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // On mount, check for token in localStorage
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("jwt_token") : null;
    if (saved) setToken(saved);
  }, []);

  const handleLogin = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem("jwt_token", newToken);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem("jwt_token");
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center bg-gradient-to-br from-sky-50 to-indigo-100 font-[family-name:var(--font-geist-sans)]">
      {/* Stylish Header */}
      <header className="w-full py-8 bg-gradient-to-r from-blue-900 to-blue-600 shadow text-white mb-1">
        <div className="max-w-3xl mx-auto px-6 flex flex-col items-center gap-2">
          <h1 className="text-4xl font-black tracking-tight mb-2 drop-shadow-lg text-white">
            Resume Tailor
          </h1>
          <p className="text-lg md:text-xl italic font-medium text-slate-100">
            Generate tailored resumes for every opportunity!
          </p>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-10 justify-center items-center w-full max-w-2xl mx-auto px-4 py-10">
        {!token ? (
          <LoginForm onLogin={handleLogin} />
        ) : (
          <>
            <div className="w-full flex flex-row-reverse mb-6">
              <button
                onClick={handleLogout}
                className="text-red-700 border border-red-200 px-3 py-1 rounded font-semibold hover:bg-red-50 shadow-sm transition flex gap-1 items-center"
                title="Logout"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1m0-9V4a2 2 0 00-2 2v12a2 2 0 002-2z"
                  />
                </svg>
                Logout
              </button>
            </div>
            <JobInputForm token={token} />
          </>
        )}
      </main>
      <footer className="w-full flex flex-col items-center justify-center py-4 bg-gray-50 border-t text-gray-600 text-sm font-medium shadow-inner">
        <span>
          © {new Date().getFullYear()} Resume Tailor. All rights reserved.
        </span>
      </footer>
    </div>
  );
}
