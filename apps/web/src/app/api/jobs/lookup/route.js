import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * Look up jobs by email address (for returning users)
 * Returns completed/reviewing jobs with their PDF URLs
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // Find jobs by email
    const jobs = await sql`
      SELECT 
        j.id,
        j.status,
        j.email,
        j.photo_count,
        j.selected_count,
        j.pdf_url,
        j.pdf_url_square,
        j.pdf_url_large,
        j.stripe_payment_status,
        j.created_at,
        j.updated_at
      FROM jobs j
      WHERE LOWER(j.email) = LOWER(${email})
        AND j.status IN ('completed', 'reviewing', 'approved', 'generating')
      ORDER BY j.created_at DESC
      LIMIT 10
    `;

    if (jobs.length === 0) {
      return Response.json({ jobs: [], found: false });
    }

    // For each completed job, get a few preview photos
    const jobsWithPreviews = await Promise.all(
      jobs.map(async (job) => {
        const photos = await sql`
          SELECT id, thumbnail_url, preview_url, download_url, marco_comment
          FROM photo_assets
          WHERE job_id = ${job.id} AND status = 'selected'
          ORDER BY sort_order ASC
          LIMIT 4
        `;
        return { ...job, previewPhotos: photos };
      }),
    );

    return Response.json({ jobs: jobsWithPreviews, found: true });
  } catch (error) {
    console.error("Error looking up jobs:", error);
    return Response.json({ error: "Failed to look up jobs" }, { status: 500 });
  }
}

/**
 * Look up jobs for authenticated user
 */
export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobs = await sql`
      SELECT 
        j.id,
        j.status,
        j.email,
        j.photo_count,
        j.selected_count,
        j.pdf_url,
        j.pdf_url_square,
        j.pdf_url_large,
        j.stripe_payment_status,
        j.created_at,
        j.updated_at
      FROM jobs j
      WHERE j.user_id = ${session.user.id}
        AND j.status IN ('completed', 'reviewing', 'approved', 'generating')
      ORDER BY j.created_at DESC
      LIMIT 10
    `;

    const jobsWithPreviews = await Promise.all(
      jobs.map(async (job) => {
        const photos = await sql`
          SELECT id, thumbnail_url, preview_url, download_url, marco_comment
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
  } catch (error) {
    console.error("Error looking up jobs:", error);
    return Response.json({ error: "Failed to look up jobs" }, { status: 500 });
  }
}
