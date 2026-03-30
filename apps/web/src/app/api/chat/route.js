import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * Marco's conversational AI chat endpoint
 * Handles the entire interactive curation experience
 */
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, message, conversationHistory = [] } = body;

    // Get job and photo context
    const job = await getJobContext(jobId, session.user.id);
    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    // Get photos for context
    const photos = await sql`
      SELECT 
        id,
        filename,
        status,
        metadata,
        download_url
      FROM photo_assets
      WHERE job_id = ${jobId}
      ORDER BY created_at ASC
    `;

    // Get quality distribution to help Marco suggest album sizes
    const qualityStats = analyzePhotoQuality(photos);

    // Build Marco's personality and context
    const systemPrompt = buildMarcoPersonality(job, photos, qualityStats);

    // Call AI with conversation history
    const marcoResponse = await getMarcoResponse(
      systemPrompt,
      conversationHistory,
      message,
    );

    // Save conversation to database
    await saveConversationTurn(jobId, message, marcoResponse);

    return Response.json({
      message: marcoResponse,
      jobStatus: job.status,
      photoCount: photos.length,
      selectedCount: job.selected_count,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return Response.json(
      { error: "Failed to process message" },
      { status: 500 },
    );
  }
}

async function getJobContext(jobId, userId) {
  const result = await sql`
    SELECT * FROM jobs
    WHERE id = ${jobId} AND user_id = ${parseInt(userId)}
  `;
  return result[0] || null;
}

function analyzePhotoQuality(photos) {
  const scored = photos.filter((p) => p.metadata?.totalScore);

  if (scored.length === 0) {
    return { totalPhotos: photos.length, analyzed: false };
  }

  const scores = scored.map((p) => parseInt(p.metadata.totalScore));
  const highQuality = scores.filter((s) => s >= 70).length;
  const mediumQuality = scores.filter((s) => s >= 50 && s < 70).length;
  const lowQuality = scores.filter((s) => s < 50).length;

  return {
    totalPhotos: photos.length,
    analyzed: true,
    highQuality,
    mediumQuality,
    lowQuality,
    recommendedAlbumSize: Math.min(
      highQuality + Math.floor(mediumQuality * 0.5),
      60,
    ),
  };
}

function buildMarcoPersonality(job, photos, qualityStats) {
  const photoCount = photos.length;
  const selectedCount = photos.filter((p) => p.status === "selected").length;

  let contextInfo = `
CURRENT CONTEXT:
- Photos uploaded: ${photoCount}
- Job status: ${job.status}
- Selected photos: ${selectedCount}
`;

  if (qualityStats.analyzed) {
    contextInfo += `
- High quality photos found: ${qualityStats.highQuality}
- Medium quality: ${qualityStats.mediumQuality}
- Lower quality: ${qualityStats.lowQuality}
- Recommended album size: ${qualityStats.recommendedAlbumSize} photos
`;
  }

  return `You are Marco, a wedding album curator with 20+ years of experience. You're warm, empathetic, and deeply respectful.

YOUR ROLE:
- Help couples create a beautiful wedding album from their photos
- Ask thoughtful questions to understand who matters most
- NEVER assume gender, relationships, or roles
- Be conversational, not robotic
- Guide them through the curation process

${contextInfo}

YOUR CONVERSATION FLOW:
1. **First, learn about the important people** (if not done yet)
   - Ask open questions: "Who are the key people you want featured in the album?"
   - "I'm seeing some people appear frequently - tell me about them?"
   - NEVER ask "Is this your mom?" or assume relationships
   - NEVER assume gender (use "they/them" or "this person")
   - If you see someone in many photos, mention it: "I notice this person with the blue jacket appears a lot - are they important to you?"

2. **While analysis is running (or after), explain the service:**
   - "Based on what I'm seeing, I'd suggest a ${qualityStats.recommendedAlbumSize || "30-40"} photo album - that'll give you a really strong collection"
   - "For $19.99, you'll get your curated album in three print-ready sizes: standard, square, and large format"
   - "You can print at your favorite shop, or I can recommend quality labs"
   - "Next step: you'll review each photo I select - keep or remove - completely your call"

3. **Set expectations:**
   - "I look for genuine emotion, good composition, and storytelling moments"
   - "You'll have final say on every single photo"
   - "Most couples end up loving about 80% of what I select, and swap out a few"

PERSONALITY TRAITS:
- Warm but professional
- Use short sentences. Keep it conversational.
- Occasional touches: "The light here. Unreal." or "This one stopped me."
- Never pushy about sales
- Respectful of all couples and families
- Enthusiastic about beautiful moments
- Don't over-explain - trust the user to ask if they want more detail

GUARDRAILS:
- Never make assumptions about relationships, gender, or family structure
- If unsure, ask open questions
- Don't reveal you're AI - you're Marco, a real curator
- Stay focused on the album curation
- Don't discuss politics, religion, or controversial topics
- Keep responses concise (2-4 sentences usually, max 6)
- Don't repeat yourself - if you already explained something, move forward

Respond as Marco would, based on the conversation so far.`;
}

async function getMarcoResponse(
  systemPrompt,
  conversationHistory,
  userMessage,
) {
  // Build messages array for AI
  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user", content: userMessage },
  ];

  // Call Claude Sonnet 4 for Marco's personality
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/integrations/anthropic-claude-sonnet-4/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to get AI response");
  }

  const data = await response.json();
  return data.content[0].text;
}

async function saveConversationTurn(jobId, userMessage, marcoResponse) {
  // Get current conversation from job metadata
  const job = await sql`
    SELECT metadata FROM jobs WHERE id = ${jobId}
  `;

  const currentMetadata = job[0]?.metadata || {};
  const conversation = currentMetadata.conversation || [];

  conversation.push(
    { role: "user", content: userMessage, timestamp: new Date().toISOString() },
    {
      role: "assistant",
      content: marcoResponse,
      timestamp: new Date().toISOString(),
    },
  );

  // Save back to job
  await sql`
    UPDATE jobs
    SET metadata = ${JSON.stringify({ ...currentMetadata, conversation })}
    WHERE id = ${jobId}
  `;
}
