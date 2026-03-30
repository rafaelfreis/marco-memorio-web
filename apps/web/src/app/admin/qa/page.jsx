"use client";

import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";

const STATUS_LABELS = {
  pending_qa: "Needs QA",
  reviewing: "Approved — Awaiting Payment",
  approved: "Paid — Awaiting Generation",
  generating: "Generating PDFs",
  completed: "Delivered",
  curating: "AI Curating",
  pending: "Pending Upload",
  failed: "Failed",
};

const STATUS_COLORS = {
  pending_qa: "bg-yellow-100 text-yellow-800",
  reviewing: "bg-blue-100 text-blue-800",
  approved: "bg-purple-100 text-purple-800",
  generating: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  curating: "bg-orange-100 text-orange-800",
  pending: "bg-gray-100 text-gray-600",
  failed: "bg-red-100 text-red-800",
};

export default function QADashboardPage() {
  const { data: user, loading: userLoading } = useUser();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending_qa");
  const [selectedJob, setSelectedJob] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [allPhotos, setAllPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchJobs();
  }, [filter]);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/qa/jobs?status=${filter}`);
      if (!r.ok) throw new Error("Failed to fetch jobs");
      const d = await r.json();
      setJobs(d.jobs || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  const openJob = async (job) => {
    setSelectedJob(job);
    setPhotosLoading(true);
    try {
      const [selectedR, allR] = await Promise.all([
        fetch(`/api/jobs/${job.id}/photos?status=selected`),
        fetch(`/api/jobs/${job.id}/photos`),
      ]);
      if (selectedR.ok) {
        const d = await selectedR.json();
        setPhotos(d.photos || []);
      }
      if (allR.ok) {
        const d = await allR.json();
        setAllPhotos(d.photos || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPhotosLoading(false);
    }
  };

  const approveJob = async (jobId) => {
    setActionLoading(true);
    try {
      const r = await fetch(`/api/admin/qa/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!r.ok) throw new Error("Failed to approve");
      setSelectedJob(null);
      setPhotos([]);
      fetchJobs();
    } catch (err) {
      console.error(err);
      setError("Failed to approve album");
    } finally {
      setActionLoading(false);
    }
  };

  const rejectPhoto = async (jobId, photoId) => {
    try {
      await fetch(`/api/jobs/${jobId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, status: "rejected" }),
      });
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      console.error(err);
    }
  };

  const addPhoto = async (jobId, photoId) => {
    try {
      await fetch(`/api/jobs/${jobId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, status: "selected" }),
      });
      const photo = allPhotos.find((p) => p.id === photoId);
      if (photo) {
        setPhotos((prev) => [...prev, { ...photo, status: "selected" }]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-[#faf9f5] flex items-center justify-center">
        <p className="text-[#5a5a5a]">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#faf9f5] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#3a3a3a] text-lg mb-4">Sign in to access QA</p>
          <a
            href="/account/signin?callbackUrl=/admin/qa"
            className="px-6 py-3 bg-[#3a3a3a] text-white rounded-xl"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  const rejectedPhotos = allPhotos.filter((p) => p.status === "rejected");
  const pendingQaCount = jobs.length;

  return (
    <div className="min-h-screen bg-[#faf9f5]">
      {/* Header */}
      <div className="bg-white" style={{ borderBottom: "2px solid #e8e5df" }}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium text-[#2a2a2a]">
              Album QA Dashboard
            </h1>
            <p className="text-sm text-[#7a7a7a] mt-1">
              Review and approve albums before delivery
            </p>
          </div>
          <a href="/" className="text-sm text-[#6a5f4f] hover:underline">
            ← Back to Marco
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {["pending_qa", "reviewing", "completed", "curating", "failed"].map(
            (s) => (
              <button
                key={s}
                onClick={() => {
                  setFilter(s);
                  setSelectedJob(null);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === s ? "bg-[#3a3a3a] text-white" : "bg-white text-[#5a5a5a] hover:bg-[#f5f0e8]"}`}
                style={filter !== s ? { border: "1px solid #e8e5df" } : {}}
              >
                {STATUS_LABELS[s] || s}
              </button>
            ),
          )}
        </div>

        {error && (
          <div
            className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 text-sm"
            style={{ border: "1px solid #fecaca" }}
          >
            {error}
          </div>
        )}

        <div className="flex gap-6">
          {/* Jobs list */}
          <div
            className={`${selectedJob ? "w-1/3" : "w-full"} space-y-3 transition-all`}
          >
            {loading ? (
              <div className="text-center py-12 text-[#7a7a7a]">
                Loading albums...
              </div>
            ) : jobs.length === 0 ? (
              <div
                className="text-center py-12 bg-white rounded-xl"
                style={{ border: "1px solid #e8e5df" }}
              >
                <p className="text-[#7a7a7a] text-lg mb-1">No albums here</p>
                <p className="text-[#9a9a9a] text-sm">
                  Nothing to review in this category
                </p>
              </div>
            ) : (
              jobs.map((job) => {
                const dateStr = new Date(job.created_at).toLocaleDateString(
                  "en-US",
                  {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                );
                const isSelected = selectedJob?.id === job.id;
                return (
                  <button
                    key={job.id}
                    onClick={() => openJob(job)}
                    className={`w-full text-left p-4 rounded-xl transition-all ${isSelected ? "bg-[#f5f0e8]" : "bg-white hover:bg-[#fdfcfa]"}`}
                    style={{
                      border: isSelected
                        ? "2px solid #6a5f4f"
                        : "1px solid #e8e5df",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#2a2a2a]">
                        {job.email}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[job.status] || "bg-gray-100 text-gray-600"}`}
                      >
                        {STATUS_LABELS[job.status] || job.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#7a7a7a]">
                      <span>{job.photo_count} uploaded</span>
                      <span>{job.selected_count} selected</span>
                      <span>{dateStr}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Detail panel */}
          {selectedJob && (
            <div
              className="w-2/3 bg-white rounded-xl p-6"
              style={{ border: "1px solid #e8e5df" }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-medium text-[#2a2a2a]">
                    {selectedJob.email}
                  </h2>
                  <p className="text-sm text-[#7a7a7a]">
                    {selectedJob.selected_count} selected from{" "}
                    {selectedJob.photo_count} ·{" "}
                    {new Date(selectedJob.created_at).toLocaleDateString(
                      "en-US",
                      { month: "long", day: "numeric", year: "numeric" },
                    )}
                  </p>
                </div>
                {selectedJob.status === "pending_qa" && (
                  <button
                    onClick={() => approveJob(selectedJob.id)}
                    disabled={actionLoading}
                    className="px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-all disabled:opacity-50"
                  >
                    {actionLoading ? "Approving..." : "✓ Approve Album"}
                  </button>
                )}
              </div>

              {photosLoading ? (
                <div className="text-center py-12 text-[#7a7a7a]">
                  Loading photos...
                </div>
              ) : (
                <>
                  {/* Selected photos */}
                  <h3 className="text-sm font-medium text-[#5a5a5a] mb-3 uppercase tracking-wide">
                    Selected Photos ({photos.length})
                  </h3>
                  <div className="grid grid-cols-3 gap-3 mb-8">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="group relative rounded-lg overflow-hidden"
                        style={{ border: "2px solid #e8e5df" }}
                      >
                        <div className="aspect-square">
                          <img
                            src={
                              photo.thumbnail_url ||
                              photo.preview_url ||
                              photo.download_url
                            }
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {photo.metadata?.totalScore && (
                          <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded-md">
                            {photo.metadata.totalScore}
                          </div>
                        )}
                        {selectedJob.status === "pending_qa" && (
                          <button
                            onClick={() =>
                              rejectPhoto(selectedJob.id, photo.id)
                            }
                            className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold hover:bg-red-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Rejected photos (available to add back) */}
                  {selectedJob.status === "pending_qa" &&
                    rejectedPhotos.length > 0 && (
                      <>
                        <h3 className="text-sm font-medium text-[#5a5a5a] mb-3 uppercase tracking-wide">
                          Rejected — Click to Add ({rejectedPhotos.length})
                        </h3>
                        <div className="grid grid-cols-4 gap-2">
                          {rejectedPhotos.map((photo) => (
                            <button
                              key={photo.id}
                              onClick={() => addPhoto(selectedJob.id, photo.id)}
                              className="aspect-square rounded-lg overflow-hidden opacity-60 hover:opacity-100 transition-opacity"
                              style={{ border: "1px solid #e8e5df" }}
                            >
                              <img
                                src={
                                  photo.thumbnail_url ||
                                  photo.preview_url ||
                                  photo.download_url
                                }
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
