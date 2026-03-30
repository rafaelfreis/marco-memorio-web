"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import useUpload from "@/utils/useUpload";

const MARCO_AVATAR =
  "https://raw.createusercontent.com/8b90a64e-fee9-4d3a-934f-cf9fc25f5aec/";

export default function MarcoChat({ jobId: initialJobId, onJobCreated, user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(initialJobId);
  const [jobStatus, setJobStatus] = useState(null);
  const [jobData, setJobData] = useState(null);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [stage, setStage] = useState("intro");
  const [email, setEmail] = useState("");
  const [curationProgress, setCurationProgress] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [typing, setTyping] = useState(false);
  const [retrieveEmail, setRetrieveEmail] = useState("");
  const [retrievedJobs, setRetrievedJobs] = useState([]);
  const [previewPage, setPreviewPage] = useState(0);
  const messagesEndRef = useRef(null);
  const progressPollRef = useRef(null);
  const fileInputRef = useRef(null);
  const [upload] = useUpload();
  const initRef = useRef(false);

  // Auto-scroll
  useEffect(() => {
    const t = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(t);
  }, [messages, curationProgress, uploadProgress, typing, previewPage]);

  // Marco opening
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    setTimeout(() => {
      setMessages([
        {
          role: "assistant",
          content:
            "I am Marco.\n\nI do one thing — I take the photos you forgot you had, and I build you something worth printing.\n\nBefore we begin, tell me: when was the wedding? And what do you remember most about that day?",
        },
      ]);
    }, 600);
  }, []);

  // Payment return check
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const payment = p.get("payment");
    const rJobId = p.get("jobId") || jobId;
    if (payment === "success" && rJobId) {
      setJobId(rJobId);
      setStage("social_share");
      initRef.current = true;
      fetch(`/api/jobs/${rJobId}/photos?status=selected`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setSelectedPhotos(d.photos || []);
        })
        .catch(() => {});
      setMessages([
        {
          role: "assistant",
          content:
            "Payment received. Thank you.\n\nBefore I generate your album — want to share a preview? Sometimes the best gift is letting people know what you're building.",
        },
      ]);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Auto-load albums if user is logged in
  useEffect(() => {
    if (!user?.id) return;
    fetch("/api/jobs/lookup")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.found && d.jobs.length > 0) {
          const completedJobs = d.jobs.filter(
            (j) => j.status === "completed" && j.pdf_url,
          );
          if (completedJobs.length > 0) {
            setRetrievedJobs(completedJobs);
            setStage("retrieve_found");
            initRef.current = true;
            setMessages([
              {
                role: "assistant",
                content: `Welcome back.\n\nI have ${completedJobs.length === 1 ? "your album" : `${completedJobs.length} albums`} from before. Want to download ${completedJobs.length === 1 ? "it" : "one"}, or start something new?`,
              },
            ]);
          }
        }
      })
      .catch(() => {});
  }, [user]);

  // Poll curation
  useEffect(() => {
    if ((stage === "curating" || stage === "pending_qa") && jobId) {
      progressPollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/jobs/${jobId}`);
          if (!r.ok) return;
          const d = await r.json();
          const job = d.job;
          if (job.metadata?.curationProgress)
            setCurationProgress(job.metadata.curationProgress);

          if (job.status === "pending_qa" && stage === "curating") {
            // AI curation done, waiting for admin QA
            setCurationProgress(null);
            setStage("pending_qa");
            marcoSays(
              "I've made my selections.\n\nNow I'm doing one final review — checking every photo one more time. I don't send anything out until I'm sure.\n\nAlmost there.",
            );
          } else if (job.status === "reviewing" || job.status === "approved") {
            // Admin approved — show to customer
            setJobStatus(job.status);
            setJobData(job);
            clearInterval(progressPollRef.current);
            setCurationProgress(null);
            const pr = await fetch(`/api/jobs/${jobId}/photos?status=selected`);
            if (pr.ok) {
              const pd = await pr.json();
              setSelectedPhotos(pd.photos || []);
            }
            setStage("reveal");
            marcoSays(
              `Done.\n\nI went through ${job.photo_count || "your"} photos. I kept ${job.selected_count}.\n\nThese are the ones that matter. The ones with weight.\n\nLook.`,
            );
          }
        } catch (e) {
          console.error("Poll error:", e);
        }
      }, 3000);
    }
    return () => {
      if (progressPollRef.current) clearInterval(progressPollRef.current);
    };
  }, [stage, jobId]);

  const marcoSays = useCallback((text, extras) => {
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: text, ...extras },
    ]);
  }, []);

  const userSays = useCallback((text) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
  }, []);

  const marcoSaysLater = useCallback(
    (text, delay = 1200, extras) => {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        marcoSays(text, extras);
      }, delay);
    },
    [marcoSays],
  );

  // ──── HANDLERS ────

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    userSays(input.trim());
    setInput("");
    if (stage === "intro") {
      setStage("upload_choice");
      marcoSaysLater(
        "Good.\n\nNow — your photos. Two ways to do this:\n\nI can connect to your Google Photos. Or you upload from your computer.\n\nEither works.",
      );
    }
  };

  const handleGoogleAuth = () => {
    userSays("I'll connect my Google Photos.");
    marcoSays(
      "Connecting to Google Photos.\n\nI will be here when you get back.",
    );
    setStage("curating");
    if (typeof window !== "undefined") {
      const w = 600,
        h = 700,
        l = window.screen.width / 2 - w / 2,
        t = window.screen.height / 2 - h / 2;
      window.open(
        "/account/signin?provider=google",
        "google-auth",
        `width=${w},height=${h},left=${l},top=${t}`,
      );
    }
  };

  const handleManualUpload = () => {
    userSays("I'll upload from my computer.");
    if (!email && !user?.email) {
      setStage("email_capture");
      marcoSaysLater("Where should I send your finished album?");
    } else {
      createJobThenUpload(email || user?.email);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    userSays(email.trim());
    await createJobThenUpload(email.trim());
  };

  const createJobThenUpload = async (addr) => {
    try {
      const r = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
      if (!r.ok) throw new Error("Failed");
      const d = await r.json();
      setJobId(d.job.id);
      if (onJobCreated) onJobCreated(d.job.id);
      setStage("uploading");
      marcoSaysLater("Good. Show me what you have.");
    } catch (err) {
      console.error(err);
      marcoSays("Something went wrong. Try again.");
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    userSays(`${files.length} photo${files.length > 1 ? "s" : ""} selected.`);
    setStage("curating");
    const line =
      files.length > 50
        ? "That's a lot of memories. Give me a few minutes — I look at every single one."
        : files.length > 20
          ? "Good collection. I'm going through each one now.\n\nI don't rush this."
          : "Got them. Let me take a careful look.";
    marcoSaysLater(line, 1500);
    try {
      const uploaded = [];
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ current: i + 1, total: files.length });
        const { url, error } = await upload({ file: files[i] });
        if (error) {
          console.error(error);
          continue;
        }
        uploaded.push({ url, filename: files[i].name });
      }
      setUploadProgress(null);
      if (!uploaded.length) {
        marcoSays("None of those uploaded. Try again.");
        setStage("uploading");
        return;
      }
      const r = await fetch(`/api/jobs/${jobId}/photos/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: uploaded }),
      });
      if (!r.ok) throw new Error("Save failed");
      setJobStatus("curating");
    } catch (err) {
      console.error(err);
      marcoSays("Something went wrong with the upload. Let's try again.");
      setStage("uploading");
    }
  };

  const handlePayment = async () => {
    userSays("Let's do it.");
    setLoading(true);
    try {
      const r = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!r.ok) throw new Error("Checkout failed");
      const d = await r.json();
      if (typeof window !== "undefined") window.location.href = d.url;
    } catch (err) {
      console.error(err);
      setLoading(false);
      marcoSays("Payment didn't go through. Try once more.");
    }
  };

  const handleShare = () => {
    userSays("Yes, I want to share it.");
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator
        .share({
          title: "Our Wedding Album — Marco Memorio",
          text: `Our wedding album — ${selectedPhotos.length} curated moments.`,
          url: typeof window !== "undefined" ? window.location.origin : "",
        })
        .catch(() => {});
    }
    marcoSaysLater(
      "Beautiful.\n\nNow let me build your album. Three formats — standard, square, and large. All print-ready.\n\nAbout a minute.",
      1500,
    );
    setTimeout(() => triggerPdf(), 3000);
  };

  const handleSkipShare = () => {
    userSays("Skip — just build the album.");
    marcoSaysLater(
      "Understood.\n\nBuilding now. Three formats. About a minute.",
      800,
    );
    setTimeout(() => triggerPdf(), 2500);
  };

  const triggerPdf = async () => {
    setStage("generating_pdf");
    try {
      const r = await fetch(`/api/jobs/${jobId}/generate-pdf`, {
        method: "POST",
      });
      if (!r.ok) throw new Error("PDF generation failed");
      const d = await r.json();
      setStage("complete");
      marcoSays(
        "Your album is ready.\n\nThree formats. Print-ready. Every photo earned its place.",
        { pdfs: d.pdfs },
      );
      setTimeout(() => {
        marcoSays(
          "Where to print:\n\n• Artifact Uprising — premium quality, US\n• Mixbook — great layouts, US\n• Snapfish — reliable, US / UK / AU\n• Chatbooks — simple and fast, US\n• Harvey Norman Photo — AU\n\nUse matte or luster paper. Hardcover. Your memories deserve archival quality.",
        );
      }, 3000);
      setTimeout(() => {
        marcoSays(
          "Your album will be here for 90 days. Come back anytime — or check your email.\n\nIt was good working with your photos.",
        );
      }, 6000);
    } catch (err) {
      console.error(err);
      marcoSays("Something went wrong building the PDFs. I'll try again.");
      setTimeout(async () => {
        try {
          const r2 = await fetch(`/api/jobs/${jobId}/generate-pdf`, {
            method: "POST",
          });
          if (r2.ok) {
            const d2 = await r2.json();
            setStage("complete");
            marcoSays("Got it. Your album is ready.", { pdfs: d2.pdfs });
          }
        } catch (e2) {
          marcoSays(
            "I couldn't generate the PDFs right now. Come back — your photos are safe.",
          );
        }
      }, 5000);
    }
  };

  // ──── RETRIEVE FLOW ────
  const handleRetrieveStart = () => {
    setStage("retrieve_email");
    setMessages([
      {
        role: "assistant",
        content:
          "Welcome back.\n\nWhat email did you use when you created your album?",
      },
    ]);
  };

  const handleRetrieveEmailSubmit = async (e) => {
    e.preventDefault();
    if (!retrieveEmail.trim()) return;
    userSays(retrieveEmail.trim());
    setLoading(true);
    try {
      const r = await fetch("/api/jobs/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: retrieveEmail.trim() }),
      });
      if (!r.ok) throw new Error("Lookup failed");
      const d = await r.json();
      setLoading(false);

      if (!d.found || d.jobs.length === 0) {
        marcoSaysLater(
          "I don't have anything under that email.\n\nWant to start a new album instead?",
          1000,
        );
        setStage("retrieve_not_found");
      } else {
        setRetrievedJobs(d.jobs);
        const completedJobs = d.jobs.filter(
          (j) => j.status === "completed" && j.pdf_url,
        );
        const pendingJobs = d.jobs.filter((j) => j.status !== "completed");

        if (completedJobs.length > 0) {
          setStage("retrieve_found");
          marcoSaysLater(
            completedJobs.length === 1
              ? `Found it. Your album — ${completedJobs[0].selected_count} photos, ready to download.`
              : `Found ${completedJobs.length} albums. Pick the one you need.`,
            1000,
          );
        } else if (pendingJobs.length > 0) {
          setStage("retrieve_found");
          marcoSaysLater(
            "Found your album. It's still being worked on — I'll have it ready soon.",
            1000,
          );
        }
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      marcoSays("Something went wrong looking that up. Try again.");
    }
  };

  const handleSelectRetrievedJob = (job) => {
    setJobId(job.id);
    setJobData(job);

    if (job.status === "completed" && job.pdf_url) {
      setStage("complete");
      marcoSays("Here's your album. Still print-ready. Still beautiful.", {
        pdfs: {
          standard: job.pdf_url,
          square: job.pdf_url_square,
          large: job.pdf_url_large,
        },
      });
    } else {
      setStage("curating");
      marcoSays(
        "This one's still in progress. I'll let you know when it's ready.",
      );
    }
  };

  const handleStartNew = () => {
    setStage("intro");
    setMessages([
      {
        role: "assistant",
        content:
          "I am Marco.\n\nI do one thing — I take the photos you forgot you had, and I build you something worth printing.\n\nBefore we begin, tell me: when was the wedding? And what do you remember most about that day?",
      },
    ]);
    setRetrievedJobs([]);
    setSelectedPhotos([]);
    setJobId(null);
    setJobData(null);
  };

  // ──── PREVIEW ────
  const handleShowPreview = () => {
    userSays("Show me what it looks like.");
    setStage("preview");
    setPreviewPage(0);
    marcoSaysLater(
      "Here's your album. Flip through it — title page, your photos, the closing.\n\nThis is what you'll be printing.",
      1200,
    );
  };

  // Preview page data
  const previewPages = [];
  if (selectedPhotos.length > 0) {
    // Title page
    previewPages.push({ type: "title" });
    // Photo pages (show first 6 for preview)
    const previewPhotos = selectedPhotos.slice(0, 6);
    previewPhotos.forEach((photo) => {
      previewPages.push({ type: "photo", photo });
    });
    // If more photos
    if (selectedPhotos.length > 6) {
      previewPages.push({ type: "more", count: selectedPhotos.length - 6 });
    }
    // End page
    previewPages.push({ type: "end" });
  }

  const currentPreviewPage = previewPages[previewPage] || null;

  const Avatar = () => (
    <img
      src={MARCO_AVATAR}
      alt="Marco"
      className="w-12 h-12 rounded-full object-cover flex-shrink-0 mt-1"
      style={{ border: "2px solid #d4cfc4" }}
    />
  );

  // ──── RENDER ────
  return (
    <div
      className="flex flex-col h-full bg-[#fdfcfa] rounded-2xl overflow-hidden"
      style={{
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)",
        border: "1px solid #e8e5df",
      }}
    >
      <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6">
        {messages.map((msg, i) => (
          <div key={i}>
            <div
              className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && <Avatar />}
              <div
                className={`max-w-[80%] md:max-w-[70%] rounded-2xl px-6 py-5 ${msg.role === "user" ? "bg-[#2a2a2a] text-[#fdfcfa]" : "bg-[#f5f0e8] text-[#2a2a2a]"}`}
                style={
                  msg.role === "assistant"
                    ? { border: "1px solid #e8e5df" }
                    : {}
                }
              >
                <p
                  className="text-[17px] leading-relaxed whitespace-pre-wrap"
                  style={{ fontWeight: 400 }}
                >
                  {msg.content}
                </p>
              </div>
            </div>
            {msg.pdfs && (
              <div className="space-y-3 mt-4 pl-16">
                {msg.pdfs.standard && (
                  <a
                    href={msg.pdfs.standard}
                    download
                    className="flex items-center gap-4 p-5 bg-white rounded-xl hover:bg-[#f5f0e8] transition-all"
                    style={{ border: "2px solid #e8e5df" }}
                  >
                    <svg
                      className="w-8 h-8 text-[#6a5f4f] flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div>
                      <div className="font-semibold text-[#2a2a2a] text-base">
                        8.5″ × 11″ — Standard
                      </div>
                      <div className="text-sm text-[#7a7a7a]">Letter size</div>
                    </div>
                  </a>
                )}
                {msg.pdfs.square && (
                  <a
                    href={msg.pdfs.square}
                    download
                    className="flex items-center gap-4 p-5 bg-white rounded-xl hover:bg-[#f5f0e8] transition-all"
                    style={{ border: "2px solid #e8e5df" }}
                  >
                    <svg
                      className="w-8 h-8 text-[#6a5f4f] flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div>
                      <div className="font-semibold text-[#2a2a2a] text-base">
                        8″ × 8″ — Square
                      </div>
                      <div className="text-sm text-[#7a7a7a]">
                        Classic album
                      </div>
                    </div>
                  </a>
                )}
                {msg.pdfs.large && (
                  <a
                    href={msg.pdfs.large}
                    download
                    className="flex items-center gap-4 p-5 bg-white rounded-xl hover:bg-[#f5f0e8] transition-all"
                    style={{ border: "2px solid #e8e5df" }}
                  >
                    <svg
                      className="w-8 h-8 text-[#6a5f4f] flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div>
                      <div className="font-semibold text-[#2a2a2a] text-base">
                        12″ × 12″ — Large
                      </div>
                      <div className="text-sm text-[#7a7a7a]">
                        Coffee table size
                      </div>
                    </div>
                  </a>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Upload progress */}
        {uploadProgress && (
          <div className="flex gap-4 justify-start">
            <Avatar />
            <div
              className="bg-[#f5f0e8] rounded-2xl px-6 py-5 max-w-[70%]"
              style={{ border: "1px solid #e8e5df" }}
            >
              <p
                className="text-base mb-2"
                style={{
                  fontWeight: 400,
                  fontStyle: "italic",
                  color: "#5a5a5a",
                }}
              >
                Uploading {uploadProgress.current} of {uploadProgress.total}...
              </p>
              <div className="w-full bg-[#e8e5df] rounded-full h-2">
                <div
                  className="bg-[#6a5f4f] h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Curation progress */}
        {curationProgress && (
          <div className="flex gap-4 justify-start">
            <Avatar />
            <div
              className="bg-[#f5f0e8] rounded-2xl px-6 py-5 max-w-[70%]"
              style={{ border: "1px solid #e8e5df" }}
            >
              <p
                className="text-base mb-2"
                style={{
                  fontWeight: 400,
                  fontStyle: "italic",
                  color: "#5a5a5a",
                }}
              >
                {curationProgress.message || "Working..."}
              </p>
              {curationProgress.current != null &&
                curationProgress.total != null && (
                  <div>
                    <div
                      className="flex justify-between text-sm mb-1"
                      style={{ color: "#7a7a7a" }}
                    >
                      <span>
                        {curationProgress.current} / {curationProgress.total}
                      </span>
                      <span>
                        {Math.round(
                          (curationProgress.current / curationProgress.total) *
                            100,
                        )}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-[#e8e5df] rounded-full h-2">
                      <div
                        className="bg-[#6a5f4f] h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(curationProgress.current / curationProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Photo grid */}
        {stage === "reveal" && selectedPhotos.length > 0 && (
          <div className="space-y-3 pl-16">
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {selectedPhotos.slice(0, 16).map((p) => (
                <div
                  key={p.id}
                  className="aspect-square rounded-lg overflow-hidden"
                  style={{ border: "2px solid #e8e5df" }}
                >
                  <img
                    src={p.thumbnail_url || p.preview_url || p.download_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            {selectedPhotos.length > 16 && (
              <p
                className="text-center text-sm"
                style={{ color: "#7a7a7a", fontStyle: "italic" }}
              >
                + {selectedPhotos.length - 16} more in your album
              </p>
            )}
          </div>
        )}

        {/* Retrieved jobs list */}
        {stage === "retrieve_found" && retrievedJobs.length > 0 && (
          <div className="space-y-3 pl-16">
            {retrievedJobs.map((job) => {
              const dateStr = new Date(job.created_at).toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric" },
              );
              return (
                <button
                  key={job.id}
                  onClick={() => handleSelectRetrievedJob(job)}
                  className="w-full text-left p-4 bg-white rounded-xl hover:bg-[#f5f0e8] transition-all"
                  style={{ border: "2px solid #e8e5df" }}
                >
                  <div className="flex items-center gap-4">
                    {/* Mini preview grid */}
                    {job.previewPhotos && job.previewPhotos.length > 0 && (
                      <div className="grid grid-cols-2 gap-1 w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden">
                        {job.previewPhotos.slice(0, 4).map((p) => (
                          <img
                            key={p.id}
                            src={
                              p.thumbnail_url || p.preview_url || p.download_url
                            }
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[#2a2a2a] text-sm">
                        {job.selected_count} photos · {dateStr}
                      </div>
                      <div className="text-xs text-[#7a7a7a] mt-1">
                        {job.status === "completed"
                          ? "Ready to download"
                          : job.status === "reviewing"
                            ? "Awaiting review"
                            : "In progress"}
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-[#9a9a9a] flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Album Preview (in-chat mockup) */}
        {stage === "preview" && currentPreviewPage && (
          <div className="pl-16">
            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: "2px solid #d4cfc4",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              }}
            >
              {/* Preview page content */}
              {currentPreviewPage.type === "title" && (
                <div
                  className="aspect-square md:aspect-[4/3] flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #1a1a1a, #2d2d2d)",
                  }}
                >
                  <div className="text-center px-8">
                    <h2
                      className="text-3xl md:text-4xl text-[#f5f5f0] mb-3"
                      style={{ fontWeight: 300, letterSpacing: "0.05em" }}
                    >
                      Your Wedding Album
                    </h2>
                    <p
                      className="text-[#d4cfc4] text-lg"
                      style={{ fontStyle: "italic" }}
                    >
                      Curated by Marco
                    </p>
                    <div className="mt-6 text-[#7a7a7a] text-2xl">❦</div>
                  </div>
                </div>
              )}
              {currentPreviewPage.type === "photo" && (
                <div className="bg-[#fafaf8]">
                  <div className="aspect-square md:aspect-[4/3] relative">
                    <img
                      src={
                        currentPreviewPage.photo.preview_url ||
                        currentPreviewPage.photo.download_url
                      }
                      alt=""
                      className="w-full h-full object-contain bg-[#fafaf8]"
                      style={{ padding: "16px" }}
                    />
                  </div>
                </div>
              )}
              {currentPreviewPage.type === "more" && (
                <div className="aspect-square md:aspect-[4/3] flex items-center justify-center bg-[#fafaf8]">
                  <div className="text-center px-8">
                    <p
                      className="text-[#5a5a5a] text-xl mb-2"
                      style={{ fontWeight: 300 }}
                    >
                      + {currentPreviewPage.count} more photos
                    </p>
                    <p
                      className="text-[#8a8a8a] text-sm"
                      style={{ fontStyle: "italic" }}
                    >
                      Each one hand-picked by Marco
                    </p>
                  </div>
                </div>
              )}
              {currentPreviewPage.type === "end" && (
                <div
                  className="aspect-square md:aspect-[4/3] flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #2d2d2d, #1a1a1a)",
                  }}
                >
                  <div className="text-center px-8">
                    <p
                      className="text-[#f5f5f0] text-xl md:text-2xl mb-6"
                      style={{
                        fontWeight: 300,
                        fontStyle: "italic",
                        lineHeight: 1.8,
                      }}
                    >
                      The end of one chapter,
                      <br />
                      the beginning of forever.
                    </p>
                    <div className="text-[#7a7a7a] text-2xl mb-4">❦</div>
                    <p className="text-[#d4cfc4] text-sm">— Marco Memorio</p>
                  </div>
                </div>
              )}

              {/* Page navigation */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-white"
                style={{ borderTop: "1px solid #e8e5df" }}
              >
                <button
                  onClick={() => setPreviewPage(Math.max(0, previewPage - 1))}
                  disabled={previewPage === 0}
                  className="px-3 py-1.5 text-sm text-[#5a5a5a] hover:text-[#2a2a2a] disabled:opacity-30 transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-xs text-[#8a8a8a]">
                  {previewPage + 1} / {previewPages.length}
                </span>
                <button
                  onClick={() =>
                    setPreviewPage(
                      Math.min(previewPages.length - 1, previewPage + 1),
                    )
                  }
                  disabled={previewPage === previewPages.length - 1}
                  className="px-3 py-1.5 text-sm text-[#5a5a5a] hover:text-[#2a2a2a] disabled:opacity-30 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PDF generating spinner */}
        {stage === "generating_pdf" && (
          <div className="flex gap-4 justify-start">
            <Avatar />
            <div
              className="bg-[#f5f0e8] rounded-2xl px-6 py-5"
              style={{ border: "1px solid #e8e5df" }}
            >
              <div className="flex gap-3">
                <div
                  className="w-5 h-5 rounded-full"
                  style={{
                    border: "2px solid #e8e5df",
                    borderTopColor: "#6a5f4f",
                    animation: "marcospin 1s linear infinite",
                  }}
                />
                <p
                  className="text-base"
                  style={{
                    fontWeight: 400,
                    fontStyle: "italic",
                    color: "#5a5a5a",
                  }}
                >
                  Building your album...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {typing && (
          <div className="flex gap-4 justify-start">
            <Avatar />
            <div
              className="bg-[#f5f0e8] rounded-2xl px-6 py-5"
              style={{ border: "1px solid #e8e5df" }}
            >
              <div className="flex gap-1.5">
                <div
                  className="w-2 h-2 bg-[#9a9a9a] rounded-full"
                  style={{ animation: "marcobounce 1.4s ease-in-out infinite" }}
                />
                <div
                  className="w-2 h-2 bg-[#9a9a9a] rounded-full"
                  style={{
                    animation: "marcobounce 1.4s ease-in-out 0.2s infinite",
                  }}
                />
                <div
                  className="w-2 h-2 bg-[#9a9a9a] rounded-full"
                  style={{
                    animation: "marcobounce 1.4s ease-in-out 0.4s infinite",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ──── BOTTOM ACTIONS ──── */}

      {stage === "intro" && (
        <form
          onSubmit={handleChatSubmit}
          style={{ borderTop: "1px solid #e8e5df" }}
          className="px-6 pb-6"
        >
          <div className="flex gap-3 pt-5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell Marco about your day..."
              className="flex-1 px-6 py-5 rounded-xl text-[17px] text-[#2a2a2a] placeholder:text-[#9a9a9a] focus:outline-none focus:ring-2 focus:ring-[#6a5f4f]"
              style={{ border: "2px solid #e8e5df", fontWeight: 400 }}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-8 py-5 bg-[#2a2a2a] text-[#fdfcfa] rounded-xl font-semibold text-base hover:bg-[#1a1a1a] transition-all disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </form>
      )}

      {stage === "upload_choice" && (
        <div
          className="px-6 pb-6 space-y-3"
          style={{ borderTop: "1px solid #e8e5df", paddingTop: "24px" }}
        >
          <button
            onClick={handleGoogleAuth}
            className="w-full px-6 py-5 bg-white text-[#2a2a2a] rounded-xl font-semibold text-base hover:bg-[#f5f0e8] transition-all flex items-center justify-center gap-3"
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
            Connect Google Photos
          </button>
          <button
            onClick={handleManualUpload}
            className="w-full px-6 py-5 bg-[#2a2a2a] text-[#fdfcfa] rounded-xl font-semibold text-base hover:bg-[#1a1a1a] transition-all"
          >
            Upload from Computer
          </button>
        </div>
      )}

      {stage === "email_capture" && (
        <form
          onSubmit={handleEmailSubmit}
          className="px-6 pb-6"
          style={{ borderTop: "1px solid #e8e5df", paddingTop: "24px" }}
        >
          <div className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 px-6 py-5 rounded-xl text-[17px] text-[#2a2a2a] placeholder:text-[#9a9a9a] focus:outline-none focus:ring-2 focus:ring-[#6a5f4f]"
              style={{ border: "2px solid #e8e5df", fontWeight: 400 }}
            />
            <button
              type="submit"
              className="px-8 py-5 bg-[#2a2a2a] text-[#fdfcfa] rounded-xl font-semibold text-base hover:bg-[#1a1a1a] transition-all"
            >
              Continue
            </button>
          </div>
        </form>
      )}

      {stage === "uploading" && (
        <div
          className="px-6 pb-6"
          style={{ borderTop: "1px solid #e8e5df", paddingTop: "24px" }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-6 py-10 rounded-xl text-center cursor-pointer hover:bg-[#f5f0e8] transition-all"
            style={{ border: "2px dashed #d4cfc4" }}
          >
            <p className="text-[#5a5a5a] font-semibold text-base mb-1">
              Click to select photos
            </p>
            <p className="text-sm text-[#8a8a8a]">
              JPG, PNG — as many as you want
            </p>
          </button>
        </div>
      )}

      {stage === "reveal" && (
        <div
          className="px-6 pb-6 pt-5 space-y-3"
          style={{ borderTop: "2px solid #e8e5df" }}
        >
          <p
            className="text-center text-base"
            style={{ color: "#5a5a5a", fontWeight: 400 }}
          >
            {selectedPhotos.length} photos curated · 3 print-ready formats
          </p>
          <button
            onClick={handleShowPreview}
            className="w-full px-6 py-5 bg-white text-[#2a2a2a] rounded-xl font-semibold text-base hover:bg-[#f5f0e8] transition-all"
            style={{ border: "2px solid #e8e5df" }}
          >
            Preview Your Album
          </button>
          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full px-6 py-6 bg-[#2a2a2a] text-[#fdfcfa] rounded-xl text-xl hover:bg-[#1a1a1a] transition-all disabled:opacity-50"
            style={{ fontWeight: 600 }}
          >
            {loading ? "Redirecting to payment..." : "Get Your Album — $19.99"}
          </button>
        </div>
      )}

      {stage === "preview" && (
        <div
          className="px-6 pb-6 pt-5"
          style={{ borderTop: "2px solid #e8e5df" }}
        >
          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full px-6 py-6 bg-[#2a2a2a] text-[#fdfcfa] rounded-xl text-xl hover:bg-[#1a1a1a] transition-all disabled:opacity-50"
            style={{ fontWeight: 600 }}
          >
            {loading ? "Redirecting to payment..." : "Get Your Album — $19.99"}
          </button>
        </div>
      )}

      {stage === "social_share" && (
        <div
          className="px-6 pb-6 space-y-3"
          style={{ borderTop: "1px solid #e8e5df", paddingTop: "24px" }}
        >
          <button
            onClick={handleShare}
            className="w-full px-6 py-5 bg-white text-[#2a2a2a] rounded-xl font-semibold text-base hover:bg-[#f5f0e8] transition-all"
            style={{ border: "2px solid #e8e5df" }}
          >
            Share a Preview
          </button>
          <button
            onClick={handleSkipShare}
            className="w-full px-6 py-5 bg-[#2a2a2a] text-[#fdfcfa] rounded-xl font-semibold text-base hover:bg-[#1a1a1a] transition-all"
          >
            Skip — Build My Album
          </button>
        </div>
      )}

      {/* Retrieve email */}
      {stage === "retrieve_email" && (
        <form
          onSubmit={handleRetrieveEmailSubmit}
          className="px-6 pb-6"
          style={{ borderTop: "1px solid #e8e5df", paddingTop: "24px" }}
        >
          <div className="flex gap-3">
            <input
              type="email"
              value={retrieveEmail}
              onChange={(e) => setRetrieveEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 px-6 py-5 rounded-xl text-[17px] text-[#2a2a2a] placeholder:text-[#9a9a9a] focus:outline-none focus:ring-2 focus:ring-[#6a5f4f]"
              style={{ border: "2px solid #e8e5df", fontWeight: 400 }}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-5 bg-[#2a2a2a] text-[#fdfcfa] rounded-xl font-semibold text-base hover:bg-[#1a1a1a] transition-all disabled:opacity-50"
            >
              {loading ? "..." : "Find"}
            </button>
          </div>
        </form>
      )}

      {/* Retrieve: found — actions */}
      {stage === "retrieve_found" && (
        <div
          className="px-6 pb-6"
          style={{ borderTop: "1px solid #e8e5df", paddingTop: "24px" }}
        >
          <button
            onClick={handleStartNew}
            className="w-full px-6 py-5 bg-[#2a2a2a] text-[#fdfcfa] rounded-xl font-semibold text-base hover:bg-[#1a1a1a] transition-all"
          >
            Start a New Album
          </button>
        </div>
      )}

      {/* Retrieve: not found */}
      {stage === "retrieve_not_found" && (
        <div
          className="px-6 pb-6 space-y-3"
          style={{ borderTop: "1px solid #e8e5df", paddingTop: "24px" }}
        >
          <button
            onClick={() => {
              setStage("retrieve_email");
              setRetrieveEmail("");
            }}
            className="w-full px-6 py-5 bg-white text-[#2a2a2a] rounded-xl font-semibold text-base hover:bg-[#f5f0e8] transition-all"
            style={{ border: "2px solid #e8e5df" }}
          >
            Try Another Email
          </button>
          <button
            onClick={handleStartNew}
            className="w-full px-6 py-5 bg-[#2a2a2a] text-[#fdfcfa] rounded-xl font-semibold text-base hover:bg-[#1a1a1a] transition-all"
          >
            Start a New Album
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes marcobounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        @keyframes marcospin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
