"use client";

import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";

export default function ReviewPhotosPage({ params }) {
  const { data: user, loading: userLoading } = useUser();
  const [job, setJob] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [allPhotos, setAllPhotos] = useState([]); // All photos for swapping
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [decisions, setDecisions] = useState({});
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [targetAlbumSize, setTargetAlbumSize] = useState(null);

  const jobId = params.jobId;

  useEffect(() => {
    if (!user) return;
    fetchPhotos();
  }, [jobId, user]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (processing || loading) return;

      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        handleDecision(true); // Keep
      } else if (
        e.key === "ArrowLeft" ||
        e.key === "Backspace" ||
        e.key === "Delete"
      ) {
        e.preventDefault();
        handleDecision(false); // Remove
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        handlePrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, processing, loading, photos.length]);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const [jobRes, selectedPhotosRes, allPhotosRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}`),
        fetch(`/api/jobs/${jobId}/photos?status=selected`),
        fetch(`/api/jobs/${jobId}/photos`), // Get all photos for swapping
      ]);

      if (!jobRes.ok || !selectedPhotosRes.ok || !allPhotosRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const jobData = await jobRes.json();
      const selectedPhotosData = await selectedPhotosRes.json();
      const allPhotosData = await allPhotosRes.json();

      setJob(jobData.job);
      setPhotos(selectedPhotosData.photos);
      setAllPhotos(allPhotosData.photos);
      setTargetAlbumSize(selectedPhotosData.photos.length);

      // Initialize decisions
      const initialDecisions = {};
      selectedPhotosData.photos.forEach((photo) => {
        initialDecisions[photo.id] = "selected";
      });
      setDecisions(initialDecisions);
    } catch (error) {
      console.error("Error fetching photos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwapPhoto = async (newPhotoId) => {
    const currentPhoto = photos[currentIndex];

    // Mark current photo as rejected
    setDecisions((prev) => ({ ...prev, [currentPhoto.id]: "rejected" }));

    // Mark new photo as selected
    setDecisions((prev) => ({ ...prev, [newPhotoId]: "selected" }));

    // Replace in photos array
    const newPhoto = allPhotos.find((p) => p.id === newPhotoId);
    const updatedPhotos = [...photos];
    updatedPhotos[currentIndex] = newPhoto;
    setPhotos(updatedPhotos);

    setShowSwapModal(false);
  };

  const handleDecision = async (keep) => {
    const photo = photos[currentIndex];
    const newStatus = keep ? "selected" : "rejected";

    setDecisions((prev) => ({ ...prev, [photo.id]: newStatus }));

    // Move to next photo
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleFinalize = async () => {
    setProcessing(true);

    try {
      // Update all photo statuses
      const updates = Object.entries(decisions).map(
        async ([photoId, status]) => {
          await fetch(`/api/jobs/${jobId}/photos`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoId, status }),
          });
        },
      );

      await Promise.all(updates);

      // Update job status to approved
      await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });

      // Redirect to job page
      window.location.href = `/jobs/${jobId}`;
    } catch (error) {
      console.error("Error finalizing review:", error);
      alert("Failed to save your selections. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] flex items-center justify-center">
        <div className="text-[#f5f5f0] text-xl font-crimson-text">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.href = "/account/signin";
    return null;
  }

  if (photos.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#f5f5f0] mb-4">No photos to review</p>
          <a href={`/jobs/${jobId}`} className="text-[#f5f5f0] underline">
            Back to job
          </a>
        </div>
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];
  const progress = ((currentIndex + 1) / photos.length) * 100;
  const keptCount = Object.values(decisions).filter(
    (d) => d === "selected",
  ).length;

  // Get available photos for swapping (not already selected)
  const availableForSwap = allPhotos.filter(
    (p) =>
      !Object.keys(decisions).includes(p.id) || decisions[p.id] !== "selected",
  );

  // Get quality score and reasoning
  const qualityScore = currentPhoto.metadata?.totalScore || null;
  const reasoning = currentPhoto.metadata?.reasoning || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] flex flex-col">
      {/* Header */}
      <div className="bg-[#1a1a1a] border-b border-[#2d2d2d] p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-crimson-text text-[#f5f5f0]">
              Review Your Album
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-[#f5f5f0] text-sm">
                Target: {targetAlbumSize} photos
              </span>
              <span className="text-[#f5f5f0] text-sm">
                {currentIndex + 1} of {photos.length}
              </span>
            </div>
          </div>
          <div className="w-full bg-[#2d2d2d] rounded-full h-2">
            <div
              className="bg-[#f5f5f0] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[#f5f5f0] opacity-75 text-sm">
              Keeping {keptCount} of {photos.length} photos
            </p>
            {keptCount !== targetAlbumSize && (
              <p className="text-yellow-400 text-sm">
                {keptCount > targetAlbumSize
                  ? `${keptCount - targetAlbumSize} over target`
                  : `${targetAlbumSize - keptCount} under target`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Photo */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full">
          <div className="bg-[#fafaf8] rounded-lg shadow-2xl overflow-hidden">
            <div className="aspect-[4/3] relative bg-black">
              <img
                src={currentPhoto.download_url}
                alt={currentPhoto.filename}
                className="w-full h-full object-contain"
              />
              {qualityScore && (
                <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg">
                  <div className="text-xs opacity-75">Quality Score</div>
                  <div className="text-2xl font-bold">{qualityScore}/100</div>
                </div>
              )}
            </div>

            {/* Marco's Reasoning */}
            <div className="p-6 bg-[#f0f0e8] space-y-4">
              {reasoning && (
                <div>
                  <h4 className="text-sm font-semibold text-[#2a2a2a] mb-2">
                    Why Marco selected this:
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {reasoning.composition && (
                      <div>
                        <span className="text-[#6a6a6a]">Composition:</span>
                        <span className="text-[#2a2a2a] ml-2">
                          {reasoning.composition}/10
                        </span>
                      </div>
                    )}
                    {reasoning.emotion && (
                      <div>
                        <span className="text-[#6a6a6a]">Emotion:</span>
                        <span className="text-[#2a2a2a] ml-2">
                          {reasoning.emotion}/10
                        </span>
                      </div>
                    )}
                    {reasoning.lighting && (
                      <div>
                        <span className="text-[#6a6a6a]">Lighting:</span>
                        <span className="text-[#2a2a2a] ml-2">
                          {reasoning.lighting}/10
                        </span>
                      </div>
                    )}
                    {reasoning.focus && (
                      <div>
                        <span className="text-[#6a6a6a]">Focus:</span>
                        <span className="text-[#2a2a2a] ml-2">
                          {reasoning.focus}/10
                        </span>
                      </div>
                    )}
                  </div>
                  {reasoning.notes && (
                    <p className="text-[#6a6a6a] text-xs mt-3 italic">
                      {reasoning.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-[#1a1a1a] border-t border-[#2d2d2d] p-6">
        <div className="max-w-4xl mx-auto">
          {currentIndex < photos.length - 1 ? (
            <div className="space-y-4">
              <div className="flex gap-4 justify-center items-center">
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="px-6 py-3 border border-[#f5f5f0] text-[#f5f5f0] rounded-lg hover:bg-[#2d2d2d] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>

                <button
                  onClick={() => handleDecision(false)}
                  className="px-8 py-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors text-lg"
                >
                  ✕ Remove
                </button>

                <button
                  onClick={() => handleDecision(true)}
                  className="px-8 py-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-lg"
                >
                  ✓ Keep
                </button>

                <button
                  onClick={() => setShowSwapModal(true)}
                  className="px-6 py-3 border border-[#f5f5f0] text-[#f5f5f0] rounded-lg hover:bg-[#2d2d2d] transition-colors"
                >
                  ⇄ Swap Photo
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-[#f5f5f0] mb-4 text-lg">
                Last photo! Ready to finalize your album?
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handlePrevious}
                  className="px-6 py-3 border border-[#f5f5f0] text-[#f5f5f0] rounded-lg hover:bg-[#2d2d2d] transition-colors"
                >
                  ← Go Back
                </button>
                <button
                  onClick={() => handleDecision(false)}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  ✕ Remove
                </button>
                <button
                  onClick={() => handleDecision(true)}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  ✓ Keep
                </button>
                <button
                  onClick={() => setShowSwapModal(true)}
                  className="px-6 py-3 border border-[#f5f5f0] text-[#f5f5f0] rounded-lg hover:bg-[#2d2d2d] transition-colors"
                >
                  ⇄ Swap
                </button>
                <button
                  onClick={handleFinalize}
                  disabled={processing}
                  className="px-8 py-3 bg-[#f5f5f0] text-[#1a1a1a] rounded-lg font-medium hover:bg-white transition-colors disabled:opacity-50"
                >
                  {processing ? "Saving..." : "Finalize Album →"}
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-[#f5f5f0] opacity-75 text-sm mt-4">
            Use keyboard: ← Previous • ✓ Keep (Enter) • ✕ Remove (Backspace) • ⇄
            Swap
          </p>
        </div>
      </div>

      {/* Swap Modal */}
      {showSwapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-[#fafaf8] rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#d0d0d0]">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-crimson-text text-[#2a2a2a]">
                  Swap with another photo
                </h2>
                <button
                  onClick={() => setShowSwapModal(false)}
                  className="text-[#6a6a6a] hover:text-[#2a2a2a] text-2xl"
                >
                  ✕
                </button>
              </div>
              <p className="text-[#6a6a6a] text-sm mt-2">
                Choose a photo to replace the current one
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                {availableForSwap.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => handleSwapPhoto(photo.id)}
                    className="aspect-square relative rounded-lg overflow-hidden group hover:ring-4 hover:ring-[#2a2a2a] transition-all"
                  >
                    <img
                      src={photo.thumbnail_url || photo.download_url}
                      alt={photo.filename}
                      className="w-full h-full object-cover"
                    />
                    {photo.metadata?.totalScore && (
                      <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                        {photo.metadata.totalScore}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {availableForSwap.length === 0 && (
                <div className="text-center py-12 text-[#6a6a6a]">
                  <p>No other photos available to swap</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
