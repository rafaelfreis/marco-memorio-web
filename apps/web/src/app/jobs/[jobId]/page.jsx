"use client";

import { useState, useEffect, useRef } from "react";

export default function JobCompletionPage({ params }) {
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [job, setJob] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollInterval = useRef(null);

  const jobId = params.jobId;

  useEffect(() => {
    // Read query params from browser URL
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      setPaymentStatus(searchParams.get("payment"));
    }
  }, []);

  useEffect(() => {
    fetchJobDetails();

    // Poll for updates while PDFs are generating
    pollInterval.current = setInterval(() => {
      fetchJobDetails();
    }, 3000);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [jobId]);

  useEffect(() => {
    // Stop polling once PDFs are ready
    if (job?.status === "completed" && job?.pdf_url) {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    }
  }, [job]);

  const fetchJobDetails = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`);

      if (!response.ok) {
        throw new Error("Job not found");
      }

      const data = await response.json();
      setJob(data.job);

      // Fetch photos if available
      if (data.job.selected_count > 0) {
        const photosRes = await fetch(
          `/api/jobs/${jobId}/photos?status=selected`,
        );
        if (photosRes.ok) {
          const photosData = await photosRes.json();
          setPhotos(photosData.photos);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#faf9f5] via-[#f5f3ed] to-[#ede9e0] flex items-center justify-center">
        <div className="text-[#3a3a3a] text-xl font-light">
          Loading your album...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#faf9f5] via-[#f5f3ed] to-[#ede9e0] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4 text-lg">{error}</p>
          <a
            href="/"
            className="px-6 py-3 bg-[#3a3a3a] text-[#fdfcfa] rounded-xl inline-block hover:bg-[#2a2a2a] transition-all"
          >
            Start New Album
          </a>
        </div>
      </div>
    );
  }

  const isGenerating = job?.status === "generating";
  const isCompleted = job?.status === "completed" && job?.pdf_url;
  const showPaymentSuccess = paymentStatus === "success";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f5] via-[#f5f3ed] to-[#ede9e0] py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-light text-[#2a2a2a] mb-3">
            {isCompleted ? "Your Album is Ready" : "Almost There"}
          </h1>
          <p className="text-xl text-[#5a5a5a] font-light italic">
            {isCompleted
              ? `${job.selected_count} curated moments, ready to print`
              : "Marco is preparing your print-ready files..."}
          </p>
        </div>

        {/* Payment Success Message */}
        {showPaymentSuccess && !isCompleted && (
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 mb-8 text-center">
            <div className="text-green-700 text-lg mb-2">
              ✓ Payment Successful
            </div>
            <p className="text-green-600 text-sm">
              Generating your album in 3 print-ready formats...
            </p>
          </div>
        )}

        {/* Generating Status */}
        {isGenerating && (
          <div className="bg-white rounded-2xl shadow-2xl p-12 mb-8 text-center border border-[#e8e5df]">
            <div className="space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 border-4 border-[#e8e5df] rounded-full"></div>
                <div
                  className="absolute inset-0 border-4 border-[#6a5f4f] rounded-full border-t-transparent"
                  style={{ animation: "spin 1s linear infinite" }}
                ></div>
              </div>
              <div>
                <h2 className="text-2xl font-light text-[#2a2a2a] mb-2">
                  Creating Your Albums
                </h2>
                <p className="text-[#7a7a7a]">Building 3 print-ready PDFs...</p>
                <p className="text-sm text-[#9a9a9a] mt-2 italic">
                  This usually takes 30-60 seconds
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Download Links (when complete) */}
        {isCompleted && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 mb-8 border border-[#e8e5df]">
            <h2 className="text-3xl font-light text-[#2a2a2a] mb-6 text-center">
              Download Your Albums
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <a
                href={job.pdf_url}
                download
                className="group flex flex-col items-center justify-center p-8 border-2 border-[#e8e5df] rounded-xl hover:border-[#6a5f4f] hover:bg-[#fdfcfa] transition-all text-center"
              >
                <svg
                  className="w-16 h-16 text-[#7a7a7a] mb-4 group-hover:text-[#6a5f4f] transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <div className="text-2xl font-light text-[#2a2a2a] mb-1">
                  8.5" × 11"
                </div>
                <div className="text-sm text-[#7a7a7a]">Standard Letter</div>
              </a>

              {job.pdf_url_square && (
                <a
                  href={job.pdf_url_square}
                  download
                  className="group flex flex-col items-center justify-center p-8 border-2 border-[#e8e5df] rounded-xl hover:border-[#6a5f4f] hover:bg-[#fdfcfa] transition-all text-center"
                >
                  <svg
                    className="w-16 h-16 text-[#7a7a7a] mb-4 group-hover:text-[#6a5f4f] transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <div className="text-2xl font-light text-[#2a2a2a] mb-1">
                    8" × 8"
                  </div>
                  <div className="text-sm text-[#7a7a7a]">Square</div>
                </a>
              )}

              {job.pdf_url_large && (
                <a
                  href={job.pdf_url_large}
                  download
                  className="group flex flex-col items-center justify-center p-8 border-2 border-[#e8e5df] rounded-xl hover:border-[#6a5f4f] hover:bg-[#fdfcfa] transition-all text-center"
                >
                  <svg
                    className="w-16 h-16 text-[#7a7a7a] mb-4 group-hover:text-[#6a5f4f] transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <div className="text-2xl font-light text-[#2a2a2a] mb-1">
                    12" × 12"
                  </div>
                  <div className="text-sm text-[#7a7a7a]">Large Square</div>
                </a>
              )}
            </div>

            <div className="border-t-2 border-[#e8e5df] pt-6">
              <h3 className="text-sm font-medium text-[#5a5a5a] mb-3 uppercase tracking-wide">
                Print Recommendations
              </h3>
              <ul className="space-y-2 text-[#7a7a7a] text-sm">
                <li>
                  • Use a professional print service for best results (e.g.,
                  Shutterfly, Artifact Uprising)
                </li>
                <li>• Choose premium matte or luster paper stock</li>
                <li>• Consider hardcover binding for a lasting keepsake</li>
                <li>
                  • PDFs are high-resolution and ready for commercial printing
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Photo Preview Grid */}
        {photos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-[#e8e5df]">
            <h3 className="text-2xl font-light text-[#2a2a2a] mb-6">
              Your Curated Selection
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {photos.slice(0, 24).map((photo) => (
                <div
                  key={photo.id}
                  className="aspect-square rounded-lg overflow-hidden border-2 border-[#e8e5df] group"
                >
                  <img
                    src={photo.thumbnail_url || photo.preview_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
            {photos.length > 24 && (
              <p className="text-center text-sm text-[#7a7a7a] mt-4 italic">
                + {photos.length - 24} more in your album
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 space-y-4">
          <p className="text-sm text-[#8a8a8a]">
            Your albums will be available for download for 90 days
          </p>
          <a
            href="/"
            className="text-[#6a5f4f] hover:underline text-sm font-medium"
          >
            Create Another Album →
          </a>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
