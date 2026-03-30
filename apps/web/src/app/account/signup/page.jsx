import { useState } from "react";
import useAuth from "@/utils/useAuth";

const MARCO_AVATAR =
  "https://raw.createusercontent.com/8b90a64e-fee9-4d3a-934f-cf9fc25f5aec/";

function SignUpPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const { signUpWithCredentials, signInWithGoogle } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Please fill in email and password");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      await signUpWithCredentials({
        email,
        password,
        name: name || undefined,
        callbackUrl: "/",
        redirect: true,
      });
    } catch (err) {
      const errorMessages = {
        EmailCreateAccount:
          "This email is already registered. Try signing in instead.",
        CredentialsSignin:
          "Something went wrong creating your account. Try again.",
        OAuthAccountNotLinked:
          "This email is already linked to Google sign-in. Use that instead.",
        AccessDenied: "Access denied.",
        Configuration: "Sign-up isn't working right now. Try again later.",
      };
      setError(
        errorMessages[err.message] || "Something went wrong. Please try again.",
      );
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle({
        callbackUrl: "/",
        redirect: true,
      });
    } catch (err) {
      setError("Google sign-up failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f5] via-[#f5f3ed] to-[#ede9e0] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Marco branding */}
        <div className="text-center mb-8">
          <img
            src={MARCO_AVATAR}
            alt="Marco"
            className="w-16 h-16 rounded-full mx-auto mb-4 object-cover"
            style={{ border: "2px solid #d4cfc4" }}
          />
          <h1
            className="text-2xl text-[#2a2a2a] mb-1"
            style={{ fontWeight: 300, letterSpacing: "0.02em" }}
          >
            Create your account
          </h1>
          <p className="text-sm text-[#7a7a7a]" style={{ fontWeight: 300 }}>
            Save your albums and come back anytime
          </p>
        </div>

        <div
          className="bg-[#fdfcfa] rounded-2xl p-8"
          style={{
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.1)",
            border: "1px solid #e8e5df",
          }}
        >
          {/* Google sign up */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full px-5 py-4 bg-white text-[#2a2a2a] rounded-xl font-medium hover:bg-[#f5f0e8] transition-all flex items-center justify-center gap-3 mb-6 disabled:opacity-50"
            style={{ border: "2px solid #e8e5df" }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-[#e8e5df]" />
            <span className="text-xs text-[#9a9a9a]">or</span>
            <div className="flex-1 h-px bg-[#e8e5df]" />
          </div>

          <form noValidate onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                className="block text-sm text-[#5a5a5a] mb-2"
                style={{ fontWeight: 300 }}
              >
                Name{" "}
                <span className="text-[#b0b0b0]" style={{ fontSize: "11px" }}>
                  (optional)
                </span>
              </label>
              <input
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-5 py-4 rounded-xl text-[#2a2a2a] placeholder:text-[#9a9a9a] focus:outline-none focus:ring-2 focus:ring-[#6a5f4f] bg-white"
                style={{ border: "2px solid #e8e5df", fontWeight: 300 }}
              />
            </div>
            <div>
              <label
                className="block text-sm text-[#5a5a5a] mb-2"
                style={{ fontWeight: 300 }}
              >
                Email
              </label>
              <input
                required
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-5 py-4 rounded-xl text-[#2a2a2a] placeholder:text-[#9a9a9a] focus:outline-none focus:ring-2 focus:ring-[#6a5f4f] bg-white"
                style={{ border: "2px solid #e8e5df", fontWeight: 300 }}
              />
            </div>
            <div>
              <label
                className="block text-sm text-[#5a5a5a] mb-2"
                style={{ fontWeight: 300 }}
              >
                Password
              </label>
              <input
                required
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-5 py-4 rounded-xl text-[#2a2a2a] placeholder:text-[#9a9a9a] focus:outline-none focus:ring-2 focus:ring-[#6a5f4f] bg-white"
                style={{ border: "2px solid #e8e5df", fontWeight: 300 }}
              />
            </div>

            {error && (
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{
                  backgroundColor: "#fef2f2",
                  color: "#b91c1c",
                  border: "1px solid #fecaca",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-4 bg-[#3a3a3a] text-[#fdfcfa] rounded-xl font-medium hover:bg-[#2a2a2a] transition-all disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p
            className="text-center text-sm text-[#7a7a7a] mt-6"
            style={{ fontWeight: 300 }}
          >
            Already have an account?{" "}
            <a
              href={`/account/signin${typeof window !== "undefined" ? window.location.search : ""}`}
              className="text-[#5a5040] hover:text-[#2a2a2a] underline"
            >
              Sign in
            </a>
          </p>
        </div>

        <div className="text-center mt-6">
          <a
            href="/"
            className="text-sm text-[#8a8a8a] hover:text-[#5a5a5a] transition-colors"
            style={{ fontWeight: 300 }}
          >
            ← Back to Marco
          </a>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;
