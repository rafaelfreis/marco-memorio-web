import sql from "@/app/api/utils/sql";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify Stripe webhook signature without the Stripe SDK
 */
function verifyStripeSignature(payload, sigHeader, secret) {
  const parts = sigHeader.split(",").reduce((acc, part) => {
    const [key, value] = part.split("=");
    acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts["t"];
  const signature = parts["v1"];

  if (!timestamp || !signature) {
    throw new Error("Invalid signature header");
  }

  // Verify the signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new Error("Signature mismatch");
  }

  // Optionally check timestamp tolerance (5 min)
  const tolerance = 300;
  const now = Math.floor(Date.now() / 1000);
  if (now - parseInt(timestamp) > tolerance) {
    throw new Error("Timestamp outside tolerance");
  }

  return JSON.parse(payload);
}

/**
 * Stripe webhook handler for payment events
 */
export async function POST(request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    let event;

    // Verify webhook signature if secret is configured
    if (process.env.STRIPE_WEBHOOK_SECRET && signature) {
      try {
        event = verifyStripeSignature(
          body,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET,
        );
      } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        return Response.json(
          { error: "Webhook signature verification failed" },
          { status: 400 },
        );
      }
    } else {
      // Fallback: parse without verification (dev only)
      console.warn(
        "No STRIPE_WEBHOOK_SECRET set — skipping signature verification",
      );
      event = JSON.parse(body);
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "checkout.session.expired":
        await handleCheckoutExpired(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return Response.json({ error: "Webhook handler failed" }, { status: 400 });
  }
}

async function handleCheckoutCompleted(session) {
  const jobId = session.metadata.jobId;

  if (!jobId) {
    console.error("No jobId in session metadata");
    return;
  }

  // Update job payment status
  await sql`
    UPDATE jobs
    SET 
      stripe_payment_status = 'paid',
      status = 'generating',
      updated_at = NOW()
    WHERE id = ${jobId}
  `;

  console.log(`Payment completed for job ${jobId} - triggering PDF generation`);

  // Trigger PDF generation for all formats (don't await - run in background)
  triggerPDFGeneration(jobId).catch((err) =>
    console.error(`PDF generation failed for job ${jobId}:`, err),
  );
}

/**
 * Trigger PDF generation in background
 */
async function triggerPDFGeneration(jobId) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/api/jobs/${jobId}/generate-pdf`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      throw new Error(`PDF generation failed: ${response.statusText}`);
    }

    console.log(`PDF generation completed for job ${jobId}`);

    // Send email notification with download links
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/api/jobs/${jobId}/notify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      console.log(`Email notification sent for job ${jobId}`);
    } catch (emailErr) {
      console.error(`Email notification failed for job ${jobId}:`, emailErr);
      // Non-critical — don't throw
    }
  } catch (error) {
    console.error(`Error triggering PDF generation for job ${jobId}:`, error);
  }
}

async function handleCheckoutExpired(session) {
  const jobId = session.metadata.jobId;

  if (!jobId) {
    return;
  }

  await sql`
    UPDATE jobs
    SET 
      stripe_payment_status = 'expired',
      updated_at = NOW()
    WHERE id = ${jobId}
  `;

  console.log(`Checkout expired for job ${jobId}`);
}
