import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * Create a new job for photo curation
 */
export async function POST(request) {
  try {
    const session = await auth();
    const body = await request.json();
    const { email, auth_provider = "email" } = body;

    if (!email && !session?.user?.email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // If user is not authenticated, create a temporary user record
    let userId = session?.user?.id;

    if (!userId) {
      // Create or find user by email
      const existingUser = await sql`
        SELECT id FROM auth_users WHERE email = ${email}
      `;

      if (existingUser.length > 0) {
        userId = existingUser[0].id;
      } else {
        const newUser = await sql`
          INSERT INTO auth_users (email, name, "emailVerified", image)
          VALUES (${email}, ${email.split("@")[0]}, NULL, NULL)
          RETURNING id
        `;
        userId = newUser[0].id;
      }
    }

    const finalEmail = email || session?.user?.email;

    // Create new job
    const result = await sql`
      INSERT INTO jobs (
        user_id,
        email,
        auth_provider,
        status,
        photo_count,
        selected_count,
        created_at,
        updated_at
      )
      VALUES (
        ${userId},
        ${finalEmail},
        ${auth_provider},
        'pending',
        0,
        0,
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    return Response.json({ job: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating job:", error);
    return Response.json({ error: "Failed to create job" }, { status: 500 });
  }
}

/**
 * Get all jobs for the current user
 */
export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobs = await sql`
      SELECT 
        id,
        status,
        email,
        photo_count,
        selected_count,
        pdf_url,
        pdf_url_square,
        pdf_url_large,
        stripe_payment_status,
        created_at,
        updated_at
      FROM jobs
      WHERE user_id = ${session.user.id}
      ORDER BY created_at DESC
    `;

    return Response.json({ jobs });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return Response.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}
