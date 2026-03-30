import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * Get all photos for a job (no auth required — jobId is the access token)
 */
export async function GET(request, { params }) {
  try {
    const { jobId } = params;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    // Verify job exists
    const jobResult = await sql`
      SELECT id FROM jobs WHERE id = ${jobId}
    `;

    if (jobResult.length === 0) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    // Fetch photos
    let photos;
    if (statusFilter) {
      photos = await sql`
        SELECT 
          id, job_id, google_photo_id, filename,
          download_url, preview_url, thumbnail_url,
          marco_comment, status, sort_order, metadata, created_at
        FROM photo_assets
        WHERE job_id = ${jobId} AND status = ${statusFilter}
        ORDER BY sort_order ASC, created_at ASC
      `;
    } else {
      photos = await sql`
        SELECT 
          id, job_id, google_photo_id, filename,
          download_url, preview_url, thumbnail_url,
          marco_comment, status, sort_order, metadata, created_at
        FROM photo_assets
        WHERE job_id = ${jobId}
        ORDER BY sort_order ASC, created_at ASC
      `;
    }

    return Response.json({ photos });
  } catch (error) {
    console.error("Error fetching photos:", error);
    return Response.json({ error: "Failed to fetch photos" }, { status: 500 });
  }
}

/**
 * Update photo status (for user review/override)
 */
export async function PATCH(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = params;
    const body = await request.json();
    const { photoId, status } = body;

    if (!photoId || !status) {
      return Response.json(
        { error: "photoId and status are required" },
        { status: 400 },
      );
    }

    if (!["selected", "rejected", "pending"].includes(status)) {
      return Response.json(
        {
          error: "Invalid status. Must be 'selected', 'rejected', or 'pending'",
        },
        { status: 400 },
      );
    }

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

    // Update photo status
    const result = await sql`
      UPDATE photo_assets
      SET 
        status = ${status},
        updated_at = NOW()
      WHERE id = ${photoId} AND job_id = ${jobId}
      RETURNING *
    `;

    if (result.length === 0) {
      return Response.json({ error: "Photo not found" }, { status: 404 });
    }

    // Update job's selected_count
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM photo_assets
      WHERE job_id = ${jobId} AND status = 'selected'
    `;

    await sql`
      UPDATE jobs
      SET 
        selected_count = ${parseInt(countResult[0].count)},
        updated_at = NOW()
      WHERE id = ${jobId}
    `;

    return Response.json({ photo: result[0] });
  } catch (error) {
    console.error("Error updating photo:", error);
    return Response.json({ error: "Failed to update photo" }, { status: 500 });
  }
}
