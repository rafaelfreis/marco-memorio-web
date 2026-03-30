import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * Analyze uploaded photos to identify recurring faces
 * Returns data Marco can use to ask intelligent questions
 */
export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = params;

    // Verify job ownership
    const jobResult = await sql`
      SELECT user_id FROM jobs WHERE id = ${jobId}
    `;

    if (jobResult.length === 0) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    if (String(jobResult[0].user_id) !== String(session.user.id)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all photos for this job
    const photos = await sql`
      SELECT download_url, filename
      FROM photo_assets
      WHERE job_id = ${jobId}
      ORDER BY created_at ASC
      LIMIT 50
    `;

    if (photos.length === 0) {
      return Response.json({ faces: [], photoCount: 0 });
    }

    // Use Vision AI to detect and cluster recurring faces
    // For now, we'll do a simplified version that just samples photos
    const faceGroups = await analyzeFacesInPhotos(photos);

    return Response.json({
      photoCount: photos.length,
      faceGroups,
      message: "Analysis complete",
    });
  } catch (error) {
    console.error("Face analysis error:", error);
    return Response.json({ error: "Failed to analyze faces" }, { status: 500 });
  }
}

/**
 * Analyze photos to find recurring people
 * Returns groups like: [{ count: 15, sampleUrl: "..." }, ...]
 */
async function analyzeFacesInPhotos(photos) {
  // Sample every 5th photo for analysis (to save API calls)
  const samplePhotos = photos.filter((_, i) => i % 5 === 0).slice(0, 10);

  const groups = [];

  for (const photo of samplePhotos) {
    try {
      // Use Claude Vision to detect faces in the image
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/integrations/gpt-vision/image-to-text`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: photo.download_url,
            prompt:
              "Count how many distinct people are visible in this wedding photo. Return only a number.",
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        const count = parseInt(data.text) || 0;

        if (count > 0) {
          groups.push({
            sampleUrl: photo.download_url,
            peopleCount: count,
            filename: photo.filename,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to analyze ${photo.filename}:`, error);
    }
  }

  return groups;
}
