"use client";

import { useState } from "react";
import useUser from "@/utils/useUser";
import useUpload from "@/utils/useUpload";
import MarcoChat from "@/components/MarcoChat";

export default function NewJobPage() {
  const { data: user, loading: userLoading } = useUser();
  const [upload, { loading: uploadLoading }] = useUpload();

  const [step, setStep] = useState(1); // 1: Create, 2: Upload, 3: Done
  const [email, setEmail] = useState("");
  const [jobId, setJobId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const handleCreateJob = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || user?.email }),
      });

      if (!response.ok) {
        throw new Error("Failed to create job");
      }

      const data = await response.json();
      setJobId(data.job.id);
      setStep(2);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
  };

  const handleUploadPhotos = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one photo");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Upload files and prepare photo data
      const photos = [];
      const total = selectedFiles.length;

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        // Upload file
        const { url, error: uploadError } = await upload({ file });

        if (uploadError) {
          console.error(`Failed to upload ${file.name}:`, uploadError);
          continue;
        }

        photos.push({
          url,
          filename: file.name,
        });

        setUploadProgress(Math.round(((i + 1) / total) * 100));
      }

      // Send to backend to associate with job
      const response = await fetch(`/api/jobs/${jobId}/photos/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos }),
      });

      if (!response.ok) {
        throw new Error("Failed to save photos to job");
      }

      setStep(3);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] flex items-center justify-center">
        <div className="text-[#f5f5f0] text-xl font-crimson-text">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-crimson-text text-[#f5f5f0] mb-6">
            Please Sign In
          </h1>
          <a
            href="/account/signin"
            className="inline-block px-8 py-3 bg-[#f5f5f0] text-[#1a1a1a] font-medium rounded hover:bg-white transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-crimson-text text-[#f5f5f0] mb-4">
            Create Your Album
          </h1>
          <p className="text-[#f5f5f0] opacity-90 text-lg italic">
            {step === 3 ? "Chat with Marco" : `Step ${step} of 3`}
          </p>
        </div>

        {/* Step 1: Create Job */}
        {step === 1 && (
          <div className="bg-[#fafaf8] rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-crimson-text text-[#2a2a2a] mb-6">
              Let's Get Started
            </h2>

            <form onSubmit={handleCreateJob}>
              <div className="mb-6">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-[#4a4a4a] mb-2"
                >
                  Email Address (optional)
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={user?.email || "your@email.com"}
                  className="w-full px-4 py-3 border border-[#d0d0d0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a2a2a] focus:border-transparent"
                />
                <p className="text-sm text-[#6a6a6a] mt-2 italic">
                  We'll use this to send you updates about your album
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#2a2a2a] text-[#f5f5f0] py-3 rounded-lg font-medium hover:bg-[#1a1a1a] transition-colors"
              >
                Start Album Project
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Upload Photos */}
        {step === 2 && (
          <div className="bg-[#fafaf8] rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-crimson-text text-[#2a2a2a] mb-6">
              Upload Your Wedding Photos
            </h2>

            <div className="mb-6">
              <div className="border-2 border-dashed border-[#d0d0d0] rounded-lg p-12 text-center hover:border-[#2a2a2a] transition-colors">
                <input
                  type="file"
                  id="photo-upload"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-[#6a6a6a]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-lg text-[#2a2a2a] mb-2">
                    Click to select photos
                  </p>
                  <p className="text-sm text-[#6a6a6a]">
                    or drag and drop your wedding photos here
                  </p>
                </label>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-4 p-4 bg-[#f0f0e8] rounded-lg">
                  <p className="text-sm text-[#4a4a4a] font-medium mb-2">
                    {selectedFiles.length} photo
                    {selectedFiles.length !== 1 ? "s" : ""} selected
                  </p>
                  <div className="max-h-40 overflow-y-auto">
                    {selectedFiles.map((file, i) => (
                      <div key={i} className="text-xs text-[#6a6a6a] py-1">
                        {file.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {uploading && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#4a4a4a]">Uploading...</span>
                  <span className="text-sm text-[#4a4a4a]">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-[#e0e0e0] rounded-full h-2">
                  <div
                    className="bg-[#2a2a2a] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleUploadPhotos}
              disabled={uploading || selectedFiles.length === 0}
              className="w-full bg-[#2a2a2a] text-[#f5f5f0] py-3 rounded-lg font-medium hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading..." : "Upload Photos"}
            </button>
          </div>
        )}

        {/* Step 3: Chat with Marco */}
        {step === 3 && (
          <div
            className="bg-[#fafaf8] rounded-lg shadow-xl overflow-hidden"
            style={{ height: "600px" }}
          >
            <MarcoChat
              jobId={jobId}
              initialMessage="Hey! I just got your photos. Let me take a quick look...

While I'm analyzing them, tell me - who are the most important people to feature in your album? I'm seeing some faces appear quite a bit, and I want to make sure I understand who matters most to you."
            />
          </div>
        )}
      </div>
    </div>
  );
}
