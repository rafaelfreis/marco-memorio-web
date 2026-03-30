import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * Get a specific job with its PDF URLs
 */
export async function GET(request, { params }) {
  try {
    const session = await auth();
    const { jobId } = params;

    // Handle the "lookup" path that gets caught by the dynamic route
    if (jobId === "lookup") {
      if (!session?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const jobs = await sql`
        SELECT 
          j.id, j.status, j.email, j.photo_count, j.selected_count,
          j.pdf_url, j.pdf_url_square, j.pdf_url_large,
          j.stripe_payment_status, j.created_at, j.updated_at
        FROM jobs j
        WHERE j.user_id = ${session.user.id}
          AND j.status IN ('completed', 'reviewing', 'approved', 'generating')
        ORDER BY j.created_at DESC
        LIMIT 10
      `;
      const jobsWithPreviews = await Promise.all(
        jobs.map(async (job) => {
          const photos = await sql`
            SELECT id, thumbnail_url, preview_url, download_url
            FROM photo_assets
            WHERE job_id = ${job.id} AND status = 'selected'
            ORDER BY sort_order ASC
            LIMIT 4
          `;
          return { ...job, previewPhotos: photos };
        }),
      );
      return Response.json({
        jobs: jobsWithPreviews,
        found: jobsWithPreviews.length > 0,
      });
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    const result = await sql`
      SELECT 
        id,
        user_id,
        status,
        email,
        photo_count,
        selected_count,
        pdf_url,
        pdf_url_square,
        pdf_url_large,
        stripe_session_id,
        stripe_payment_status,
        metadata,
        created_at,
        updated_at
      FROM jobs
      WHERE id = ${jobId}
    `;

    if (result.length === 0) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    const job = result[0];

    // If user is authenticated, verify ownership
    if (session?.user?.id && String(job.user_id) !== String(session.user.id)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json({ job });
  } catch (error) {
    console.error("Error fetching job:", error);
    return Response.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}

/**
 * Update job status or metadata
 */
export async function PATCH(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = params;
    const body = await request.json();

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

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (body.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(body.status);
    }

    if (body.selected_count !== undefined) {
      updates.push(`selected_count = $${paramIndex++}`);
      values.push(body.selected_count);
    }

    if (body.stripe_payment_status) {
      updates.push(`stripe_payment_status = $${paramIndex++}`);
      values.push(body.stripe_payment_status);
    }

    if (updates.length === 0) {
      return Response.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    updates.push(`updated_at = NOW()`);
    values.push(jobId);

    const updateQuery = `
      UPDATE jobs
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await sql(updateQuery, values);

    return Response.json({ job: result[0] });
  } catch (error) {
    console.error("Error updating job:", error);
    return Response.json({ error: "Failed to update job" }, { status: 500 });
  }
}
