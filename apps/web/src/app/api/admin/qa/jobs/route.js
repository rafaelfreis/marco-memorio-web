import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * Get all jobs filtered by status (admin QA dashboard)
 */
export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending_qa";

    const jobs = await sql`
      SELECT 
        j.id,
        j.user_id,
        j.status,
        j.email,
        j.photo_count,
        j.selected_count,
        j.pdf_url,
        j.pdf_url_square,
        j.pdf_url_large,
        j.stripe_payment_status,
        j.metadata,
        j.created_at,
        j.updated_at
      FROM jobs j
      WHERE j.status = ${status}
      ORDER BY j.created_at DESC
      LIMIT 50
    `;

    return Response.json({ jobs });
  } catch (error) {
    console.error("Error fetching QA jobs:", error);
    return Response.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}
