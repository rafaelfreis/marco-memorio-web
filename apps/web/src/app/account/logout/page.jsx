import { useState } from "react";
import useAuth from "@/utils/useAuth";

const MARCO_AVATAR =
  "https://raw.createusercontent.com/8b90a64e-fee9-4d3a-934f-cf9fc25f5aec/";

function LogoutPage() {
  const [loading, setLoading] = useState(false);
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut({
        callbackUrl: "/",
        redirect: true,
      });
    } catch (err) {
      console.error("Sign out error:", err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f5] via-[#f5f3ed] to-[#ede9e0] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <img
          src={MARCO_AVATAR}
          alt="Marco"
          className="w-16 h-16 rounded-full mx-auto mb-6 object-cover"
          style={{ border: "2px solid #d4cfc4" }}
        />

        <div
          className="bg-[#fdfcfa] rounded-2xl p-8"
          style={{
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.1)",
            border: "1px solid #e8e5df",
          }}
        >
          <h1
            className="text-2xl text-[#2a2a2a] mb-2"
            style={{ fontWeight: 300, letterSpacing: "0.02em" }}
          >
            Sign out
          </h1>
          <p
            className="text-sm text-[#7a7a7a] mb-8"
            style={{ fontWeight: 300 }}
          >
            Your albums are saved. Come back anytime within 90 days.
          </p>

          <button
            onClick={handleSignOut}
            disabled={loading}
            className="w-full px-6 py-4 bg-[#3a3a3a] text-[#fdfcfa] rounded-xl font-medium hover:bg-[#2a2a2a] transition-all disabled:opacity-50 mb-4"
          >
            {loading ? "Signing out..." : "Sign Out"}
          </button>

          <a
            href="/"
            className="inline-block text-sm text-[#8a8a8a] hover:text-[#5a5a5a] transition-colors"
            style={{ fontWeight: 300 }}
          >
            ← Back to Marco
          </a>
        </div>
      </div>
    </div>
  );
}

export default LogoutPage;
