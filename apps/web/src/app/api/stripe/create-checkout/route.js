import sql from "@/app/api/utils/sql";

/**
 * Create a Stripe checkout session for album purchase (no auth required)
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { jobId } = body;

    // Get job details
    const jobResult = await sql`
      SELECT * FROM jobs WHERE id = ${jobId}
    `;

    if (jobResult.length === 0) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    const job = jobResult[0];

    // Create Stripe checkout session
    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "payment_method_types[0]": "card",
          "line_items[0][price_data][currency]": "usd",
          "line_items[0][price_data][product_data][name]":
            "Marco Memorio - Curated Wedding Album",
          "line_items[0][price_data][product_data][description]": `${job.selected_count} curated photos in 3 print-ready formats`,
          "line_items[0][price_data][unit_amount]": "1999",
          "line_items[0][quantity]": "1",
          mode: "payment",
          customer_email: job.email,
          success_url: `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/?payment=success&jobId=${jobId}`,
          cancel_url: `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/?payment=cancelled&jobId=${jobId}`,
          "metadata[jobId]": jobId,
          "metadata[userId]": job.user_id.toString(),
        }),
      },
    );

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      console.error("Stripe error:", errorText);
      throw new Error("Failed to create checkout session");
    }

    const stripeSession = await stripeResponse.json();

    // Save session ID to job
    await sql`
      UPDATE jobs
      SET 
        stripe_session_id = ${stripeSession.id},
        updated_at = NOW()
      WHERE id = ${jobId}
    `;

    return Response.json({
      sessionId: stripeSession.id,
      url: stripeSession.url,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return Response.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
