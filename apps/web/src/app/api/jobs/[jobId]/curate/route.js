import sql from "@/app/api/utils/sql";

/**
 * AI-powered photo curation using Claude Opus 4.1 Vision
 */
export async function POST(request, { params }) {
  try {
    const { jobId } = params;

    // Verify job exists (no auth required for curation)
    const jobResult = await sql`
      SELECT id, user_id, status
      FROM jobs
      WHERE id = ${jobId}
    `;

    if (jobResult.length === 0) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    // Fetch all pending photos
    const photos = await sql`
      SELECT id, download_url, filename
      FROM photo_assets
      WHERE job_id = ${jobId} AND status = 'pending'
      ORDER BY created_at ASC
    `;

    if (photos.length === 0) {
      return Response.json({ error: "No photos to curate" }, { status: 400 });
    }

    // Update job status to curating
    await updateProgress(jobId, {
      stage: "analyzing",
      current: 0,
      total: photos.length,
      message: "Starting photo analysis...",
    });

    await sql`
      UPDATE jobs
      SET status = 'curating', updated_at = NOW()
      WHERE id = ${jobId}
    `;

    // Score each photo with Claude Vision
    const scoredPhotos = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];

      // Update progress
      await updateProgress(jobId, {
        stage: "analyzing",
        current: i + 1,
        total: photos.length,
        message: `Analyzing photo ${i + 1} of ${photos.length}...`,
      });

      try {
        const score = await scorePhotoWithAI(photo.download_url);
        scoredPhotos.push({
          ...photo,
          score: score.totalScore,
          analysis: score,
        });
      } catch (error) {
        console.error(`Failed to score photo ${photo.id}:`, error);
        // Fallback: assign median score if AI fails
        scoredPhotos.push({
          ...photo,
          score: 50,
          analysis: null,
        });
      }
    }

    // Update progress: scoring complete
    await updateProgress(jobId, {
      stage: "selecting",
      current: 0,
      total: 1,
      message: "Selecting the best moments...",
    });

    // Sort by score and select top 40%
    scoredPhotos.sort((a, b) => b.score - a.score);
    const selectionCount = Math.ceil(scoredPhotos.length * 0.4);
    const selectedPhotos = scoredPhotos.slice(0, selectionCount);
    const rejectedPhotos = scoredPhotos.slice(selectionCount);

    // Update progress: finalizing
    await updateProgress(jobId, {
      stage: "finalizing",
      current: 0,
      total: selectedPhotos.length,
      message: "Finalizing selections...",
    });

    // Update database with selections
    for (let i = 0; i < selectedPhotos.length; i++) {
      const photo = selectedPhotos[i];

      await sql`
        UPDATE photo_assets
        SET 
          status = 'selected',
          sort_order = ${i + 1},
          metadata = ${JSON.stringify(photo.analysis)},
          updated_at = NOW()
        WHERE id = ${photo.id}
      `;

      // Update progress
      await updateProgress(jobId, {
        stage: "finalizing",
        current: i + 1,
        total: selectedPhotos.length,
        message: `Finalizing ${i + 1} of ${selectedPhotos.length} photos...`,
      });
    }

    // Mark rejected photos
    for (const photo of rejectedPhotos) {
      await sql`
        UPDATE photo_assets
        SET 
          status = 'rejected',
          metadata = ${JSON.stringify(photo.analysis)},
          updated_at = NOW()
        WHERE id = ${photo.id}
      `;
    }

    // Clear progress and update job status
    await sql`
      UPDATE jobs
      SET 
        status = 'pending_qa',
        selected_count = ${selectionCount},
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{curationProgress}', 'null'::jsonb),
        updated_at = NOW()
      WHERE id = ${jobId}
    `;

    return Response.json({
      success: true,
      total: photos.length,
      selected: selectionCount,
      rejected: rejectedPhotos.length,
    });
  } catch (error) {
    console.error("Curation error:", error);

    // Reset job status on failure
    try {
      await sql`
        UPDATE jobs
        SET status = 'pending', updated_at = NOW()
        WHERE id = ${params.jobId}
      `;
    } catch (resetError) {
      console.error("Failed to reset job status:", resetError);
    }

    return Response.json({ error: "Failed to curate photos" }, { status: 500 });
  }
}

/**
 * Update curation progress in job metadata
 */
async function updateProgress(jobId, progress) {
  await sql`
    UPDATE jobs
    SET 
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{curationProgress}',
        ${JSON.stringify(progress)}::jsonb
      ),
      updated_at = NOW()
    WHERE id = ${jobId}
  `;
}

/**
 * Score a photo using Claude Opus 4.1 Vision
 * Returns scores for composition, emotion, technical quality, and storytelling
 */
async function scorePhotoWithAI(imageUrl) {
  // Fetch image and convert to base64
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = Buffer.from(imageBuffer).toString("base64");
  const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

  const prompt = `You are Marco, an expert wedding photographer with 20 years of experience curating albums. Analyze this wedding photo and score it on four dimensions (0-100 each):

1. **Composition** (0-100): Rule of thirds, framing, balance, visual flow. Does it draw the eye naturally?
2. **Emotion** (0-100): Genuine moments vs. posed. Does it capture real feeling, laughter, tears, intimacy?
3. **Technical Quality** (0-100): Focus, lighting, exposure, clarity. Is it print-worthy?
4. **Storytelling** (0-100): Narrative value for an album. Does it tell a unique story about this day?

Respond in JSON format only:
{
  "composition": <score>,
  "emotion": <score>,
  "technical": <score>,
  "storytelling": <score>,
  "reasoning": "<2-3 sentence explanation of what makes this photo special or weak>"
}`;

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/integrations/anthropic-claude-opus-4-1/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Claude Vision API failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  // Parse JSON response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse Claude response as JSON");
  }

  const scores = JSON.parse(jsonMatch[0]);

  // Calculate weighted total (emotion and storytelling weighted higher)
  const totalScore =
    scores.composition * 0.2 +
    scores.emotion * 0.35 +
    scores.technical * 0.2 +
    scores.storytelling * 0.25;

  return {
    ...scores,
    totalScore: Math.round(totalScore),
  };
}
