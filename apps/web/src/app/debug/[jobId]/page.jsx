"use client";

import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";

/**
 * Debug page to view AI curation scores and analysis
 * Shows what Marco's AI vision actually sees in each photo
 * Access at /debug/[jobId]
 */
export default function DebugJobPage({ params }) {
  const jobId = params?.jobId;
  const { data: user, loading: userLoading } = useUser();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userLoading && user && jobId) {
      fetchPhotos();
    }
  }, [userLoading, user, jobId]);

  const fetchPhotos = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/photos`);
      if (!response.ok) {
        throw new Error("Failed to fetch photos");
      }
      const data = await response.json();
      setPhotos(data.photos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-white">Please sign in to view this page</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  // Separate selected and rejected photos
  const selectedPhotos = photos.filter((p) => p.status === "selected");
  const rejectedPhotos = photos.filter((p) => p.status === "rejected");

  return (
    <div className="min-h-screen bg-[#1a1a1a] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-crimson-text text-[#f5f5f0] mb-2">
            Marco's AI Analysis
          </h1>
          <p className="text-[#f5f5f0] opacity-75">Job ID: {jobId}</p>
          <div className="mt-4 flex gap-4 text-sm">
            <span className="text-green-400">
              ✓ Selected: {selectedPhotos.length}
            </span>
            <span className="text-red-400">
              ✗ Rejected: {rejectedPhotos.length}
            </span>
            <span className="text-[#f5f5f0] opacity-75">
              Total: {photos.length}
            </span>
          </div>
        </div>

        {/* Selected Photos */}
        {selectedPhotos.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-crimson-text text-green-400 mb-6">
              Selected Photos (Top{" "}
              {Math.round((selectedPhotos.length / photos.length) * 100)}%)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {selectedPhotos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} selected={true} />
              ))}
            </div>
          </div>
        )}

        {/* Rejected Photos */}
        {rejectedPhotos.length > 0 && (
          <div>
            <h2 className="text-2xl font-crimson-text text-red-400 mb-6">
              Rejected Photos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {rejectedPhotos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} selected={false} />
              ))}
            </div>
          </div>
        )}

        {photos.length === 0 && (
          <div className="text-center text-[#f5f5f0] opacity-75 py-12">
            No photos found for this job
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoCard({ photo, selected }) {
  const metadata = photo.metadata || {};
  const totalScore = metadata.totalScore || 0;
  const composition = metadata.composition || 0;
  const emotion = metadata.emotion || 0;
  const technical = metadata.technical || 0;
  const storytelling = metadata.storytelling || 0;
  const reasoning = metadata.reasoning || "No AI analysis available";

  return (
    <div
      className={`bg-[#2a2a2a] rounded-lg overflow-hidden border-2 ${
        selected ? "border-green-500" : "border-red-500"
      }`}
    >
      <div className="aspect-video bg-[#1a1a1a] relative">
        <img
          src={photo.preview_url}
          alt={photo.filename}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3 bg-black/80 px-3 py-1 rounded-full">
          <span className="text-white font-bold text-lg">{totalScore}</span>
          <span className="text-white/75 text-sm ml-1">/ 100</span>
        </div>
      </div>

      <div className="p-4">
        {/* Filename */}
        <div className="text-xs text-[#f5f5f0] opacity-50 mb-3 truncate">
          {photo.filename}
        </div>

        {/* Marco's Comment */}
        {photo.marco_comment && (
          <div className="mb-4 p-3 bg-[#3a3a3a] rounded">
            <div className="text-xs text-[#f5f5f0] opacity-50 mb-1">
              Marco says:
            </div>
            <div className="text-[#f5f5f0] italic font-crimson-text">
              "{photo.marco_comment}"
            </div>
          </div>
        )}

        {/* Score Breakdown */}
        <div className="space-y-2 mb-3">
          <ScoreBar label="Composition" score={composition} color="blue" />
          <ScoreBar label="Emotion" score={emotion} color="purple" />
          <ScoreBar label="Technical" score={technical} color="green" />
          <ScoreBar label="Storytelling" score={storytelling} color="orange" />
        </div>

        {/* AI Reasoning */}
        {reasoning && (
          <div className="mt-3 p-3 bg-[#1a1a1a] rounded text-xs text-[#f5f5f0] opacity-75">
            <div className="font-bold mb-1">AI Analysis:</div>
            {reasoning}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBar({ label, score, color }) {
  const colorClasses = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    green: "bg-green-500",
    orange: "bg-orange-500",
  };

  return (
    <div>
      <div className="flex justify-between text-xs text-[#f5f5f0] opacity-75 mb-1">
        <span>{label}</span>
        <span>{score}/100</span>
      </div>
      <div className="w-full bg-[#1a1a1a] rounded-full h-2">
        <div
          className={`h-2 rounded-full ${colorClasses[color]}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
