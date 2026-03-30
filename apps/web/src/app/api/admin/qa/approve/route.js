import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * Approve an album after QA review
 * Changes status from pending_qa → reviewing (customer can now see it)
 */
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return Response.json({ error: "jobId is required" }, { status: 400 });
    }

    // Verify job exists and is in pending_qa
    const jobResult = await sql`
      SELECT id, status, email, selected_count
      FROM jobs
      WHERE id = ${jobId}
    `;

    if (jobResult.length === 0) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    const job = jobResult[0];

    if (job.status !== "pending_qa") {
      return Response.json(
        { error: `Job is in '${job.status}' status, not 'pending_qa'` },
        { status: 400 },
      );
    }

    // Update selected_count based on current selected photos
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM photo_assets
      WHERE job_id = ${jobId} AND status = 'selected'
    `;

    const selectedCount = parseInt(countResult[0].count);

    // Approve — move to reviewing (customer can now see the album)
    await sql`
      UPDATE jobs
      SET 
        status = 'reviewing',
        selected_count = ${selectedCount},
        updated_at = NOW()
      WHERE id = ${jobId}
    `;

    return Response.json({
      success: true,
      jobId,
      selectedCount,
      message: "Album approved — customer will see it now",
    });
  } catch (error) {
    console.error("Error approving job:", error);
    return Response.json({ error: "Failed to approve album" }, { status: 500 });
  }
}
