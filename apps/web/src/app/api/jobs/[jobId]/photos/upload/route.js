import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { upload } from "@/app/api/utils/upload";

/**
 * Upload photos to a job
 */
export async function POST(request, { params }) {
  try {
    const session = await auth();
    const { jobId } = params;

    // Verify job exists
    const jobResult = await sql`
      SELECT user_id, status, email FROM jobs WHERE id = ${jobId}
    `;

    if (jobResult.length === 0) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    const job = jobResult[0];

    // If user is authenticated, verify ownership
    if (session?.user?.id && String(job.user_id) !== String(session.user.id)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the user_id from the job for inserting photos
    const userId = job.user_id;

    const body = await request.json();
    const { photos } = body; // Array of { url, filename } or { base64, filename }

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return Response.json(
        { error: "photos array is required" },
        { status: 400 },
      );
    }

    // Upload and insert photos
    const uploadedPhotos = [];

    for (const photo of photos) {
      let downloadUrl;
      let mimeType;

      // Upload the photo
      if (photo.url) {
        const result = await upload({ url: photo.url });
        downloadUrl = result.url;
        mimeType = result.mimeType;
      } else if (photo.base64) {
        const result = await upload({ base64: photo.base64 });
        downloadUrl = result.url;
        mimeType = result.mimeType;
      } else {
        console.error("Photo missing url or base64:", photo);
        continue;
      }

      // Insert into database
      const insertResult = await sql`
        INSERT INTO photo_assets (
          job_id,
          user_id,
          google_photo_id,
          filename,
          download_url,
          preview_url,
          thumbnail_url,
          status,
          created_at,
          updated_at
        )
        VALUES (
          ${jobId},
          ${userId},
          ${photo.googlePhotoId || null},
          ${photo.filename || "untitled.jpg"},
          ${downloadUrl},
          ${downloadUrl},
          ${downloadUrl},
          'pending',
          NOW(),
          NOW()
        )
        RETURNING *
      `;

      uploadedPhotos.push(insertResult[0]);
    }

    // Update job photo count
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM photo_assets
      WHERE job_id = ${jobId}
    `;

    await sql`
      UPDATE jobs
      SET 
        photo_count = ${parseInt(countResult[0].count)},
        status = 'curating',
        updated_at = NOW()
      WHERE id = ${jobId}
    `;

    // Trigger AI curation in background (don't await)
    triggerCuration(jobId).catch((err) =>
      console.error(`Background curation failed for job ${jobId}:`, err),
    );

    return Response.json({
      success: true,
      uploaded: uploadedPhotos.length,
      photos: uploadedPhotos,
    });
  } catch (error) {
    console.error("Error uploading photos:", error);
    return Response.json({ error: "Failed to upload photos" }, { status: 500 });
  }
}

/**
 * Trigger AI curation in the background
 */
async function triggerCuration(jobId) {
  await fetch(
    `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/api/jobs/${jobId}/curate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
  );
}
