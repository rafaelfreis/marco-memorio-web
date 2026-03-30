import sql from "@/app/api/utils/sql";

/**
 * Send email notification with album download links
 * Called after PDF generation is complete
 */
export async function POST(request, { params }) {
  try {
    const { jobId } = params;

    const jobResult = await sql`
      SELECT id, email, pdf_url, pdf_url_square, pdf_url_large, selected_count, status
      FROM jobs
      WHERE id = ${jobId}
    `;

    if (jobResult.length === 0) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    const job = jobResult[0];

    if (!job.email) {
      return Response.json({ error: "No email on file" }, { status: 400 });
    }

    if (job.status !== "completed") {
      return Response.json({ error: "Album not ready yet" }, { status: 400 });
    }

    // Build the email HTML
    const emailHtml = buildEmailHtml(job);

    // Send via platform email integration
    const emailResponse = await fetch(
      `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/integrations/email/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: job.email,
          subject: "Your Wedding Album is Ready — Marco Memorio",
          html: emailHtml,
        }),
      },
    );

    if (!emailResponse.ok) {
      console.error("Email send failed:", await emailResponse.text());
      // Don't throw — email is best-effort
      return Response.json({
        success: false,
        message: "Email delivery failed but album is accessible via link",
      });
    }

    return Response.json({ success: true, message: "Email sent" });
  } catch (error) {
    console.error("Notification error:", error);
    return Response.json(
      { error: "Failed to send notification" },
      { status: 500 },
    );
  }
}

function buildEmailHtml(job) {
  const appUrl = process.env.NEXT_PUBLIC_CREATE_APP_URL || "";
  const albumUrl = `${appUrl}/jobs/${job.id}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#faf9f5;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf9f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;border:1px solid #e8e5df;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a1a,#2d2d2d);padding:48px 40px;text-align:center;">
              <h1 style="color:#f5f5f0;font-size:28px;font-weight:400;letter-spacing:0.05em;margin:0 0 8px 0;">Your Album is Ready</h1>
              <p style="color:#d4cfc4;font-size:16px;font-style:italic;margin:0;">Curated by Marco</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="color:#2a2a2a;font-size:16px;line-height:1.7;margin:0 0 24px 0;">
                Your wedding album is complete. ${job.selected_count} photos, handpicked. Three formats, print-ready.
              </p>

              <p style="color:#5a5a5a;font-size:14px;line-height:1.6;margin:0 0 32px 0;font-style:italic;">
                Every photo earned its place.
              </p>

              <!-- Download Links -->
              <table width="100%" cellpadding="0" cellspacing="0">
                ${
                  job.pdf_url
                    ? `<tr>
                  <td style="padding:12px 0;">
                    <a href="${job.pdf_url}" style="display:block;padding:16px 20px;background-color:#fdfcfa;border:2px solid #e8e5df;border-radius:12px;text-decoration:none;color:#2a2a2a;">
                      <strong style="font-size:15px;">8.5″ × 11″ — Standard</strong>
                      <br><span style="font-size:13px;color:#7a7a7a;">Letter size, most versatile</span>
                    </a>
                  </td>
                </tr>`
                    : ""
                }
                ${
                  job.pdf_url_square
                    ? `<tr>
                  <td style="padding:12px 0;">
                    <a href="${job.pdf_url_square}" style="display:block;padding:16px 20px;background-color:#fdfcfa;border:2px solid #e8e5df;border-radius:12px;text-decoration:none;color:#2a2a2a;">
                      <strong style="font-size:15px;">8″ × 8″ — Square</strong>
                      <br><span style="font-size:13px;color:#7a7a7a;">Classic album format</span>
                    </a>
                  </td>
                </tr>`
                    : ""
                }
                ${
                  job.pdf_url_large
                    ? `<tr>
                  <td style="padding:12px 0;">
                    <a href="${job.pdf_url_large}" style="display:block;padding:16px 20px;background-color:#fdfcfa;border:2px solid #e8e5df;border-radius:12px;text-decoration:none;color:#2a2a2a;">
                      <strong style="font-size:15px;">12″ × 12″ — Large</strong>
                      <br><span style="font-size:13px;color:#7a7a7a;">Coffee table size</span>
                    </a>
                  </td>
                </tr>`
                    : ""
                }
              </table>

              <!-- View online link -->
              <p style="text-align:center;margin:32px 0 0 0;">
                <a href="${albumUrl}" style="color:#6a5f4f;font-size:14px;">View your album online →</a>
              </p>
            </td>
          </tr>

          <!-- Print recommendations -->
          <tr>
            <td style="padding:0 40px 32px 40px;">
              <div style="border-top:1px solid #e8e5df;padding-top:24px;">
                <p style="color:#5a5a5a;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px 0;font-weight:600;">Print Recommendations</p>
                <p style="color:#7a7a7a;font-size:13px;line-height:1.6;margin:0;">
                  Use matte or luster paper. Hardcover binding. Your memories deserve archival quality.
                  <br><br>
                  Recommended: Artifact Uprising · Mixbook · Snapfish · Chatbooks
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e8e5df;text-align:center;">
              <p style="color:#9a9a9a;font-size:12px;margin:0;">
                Your album will be available for 90 days.
                <br>
                Marco Memorio — Your memories deserve better.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
