"use client";

import { useState, useEffect, useRef } from "react";
import useUser from "@/utils/useUser";
import MarcoChat from "@/components/MarcoChat";

export default function HomePage() {
  const { data: user, loading: userLoading } = useUser();
  const [currentJobId, setCurrentJobId] = useState(null);
  const chatRef = useRef(null);

  if (userLoading) {
    return (
      <div className="min-h-screen bg-[#faf9f5] flex items-center justify-center">
        <div className="text-[#3a3a3a] text-xl font-medium">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f5] via-[#f5f3ed] to-[#ede9e0] flex flex-col">
      {/* Header bar - compact tab style */}
      <div className="flex items-center justify-between px-4 md:px-6 py-2 border-b border-[#e8e5df] bg-white/50">
        <img
          src="https://ucarecdn.com/b106f8c4-46bf-4385-9942-e11e42223895/-/format/auto/"
          alt="Marco Memorio"
          className="h-4 md:h-5"
          style={{ objectFit: "contain" }}
        />
        <div className="flex items-center gap-3">
          {user && (
            <a
              href="/admin/qa"
              className="px-3 py-1.5 text-xs md:text-sm text-[#6a5f4f] hover:text-[#2a2a2a] transition-colors font-medium"
            >
              QA Dashboard
            </a>
          )}
          {!user ? (
            <a
              href="/account/signin"
              className="px-3 py-1.5 text-xs md:text-sm text-[#5a5a5a] hover:text-[#2a2a2a] transition-colors font-medium"
            >
              Log in to retrieve album
            </a>
          ) : (
            <button
              onClick={() => {
                window.location.href = "/account/logout";
              }}
              className="px-3 py-1.5 text-xs md:text-sm text-[#5a5a5a] hover:text-[#2a2a2a] transition-colors font-medium"
            >
              Sign out
            </button>
          )}
        </div>
      </div>

      {/* The chat IS the page */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-4xl h-[85vh] md:h-[80vh]">
          <MarcoChat
            jobId={currentJobId}
            onJobCreated={setCurrentJobId}
            user={user}
            ref={chatRef}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-6 text-sm text-[#7a7a7a] font-medium">
        Marco Memorio — Albums stored for 90 days
      </div>
    </div>
  );
}
