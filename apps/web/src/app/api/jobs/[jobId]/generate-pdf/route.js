import sql from "@/app/api/utils/sql";

/**
 * Generate PDFs for a completed job in three sizes (no auth required - runs after payment webhook)
 */
export async function POST(request, { params }) {
  try {
    const { jobId } = params;

    // Fetch job (no auth check - webhook triggers this)
    const jobResult = await sql`
      SELECT id, user_id, status, stripe_payment_status
      FROM jobs
      WHERE id = ${jobId}
    `;

    if (jobResult.length === 0) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    const job = jobResult[0];

    // Verify payment was completed
    if (job.stripe_payment_status !== "paid") {
      return Response.json({ error: "Payment not completed" }, { status: 402 });
    }

    // Fetch selected photos for this job
    const photos = await sql`
      SELECT id, download_url, filename, sort_order
      FROM photo_assets
      WHERE job_id = ${jobId}
        AND status = 'selected'
      ORDER BY sort_order ASC, created_at ASC
    `;

    if (photos.length === 0) {
      return Response.json(
        { error: "No selected photos found for this job" },
        { status: 400 },
      );
    }

    // Generate PDFs in three sizes
    const pdfUrls = await Promise.all([
      generatePDF(photos, "8x8", jobId),
      generatePDF(photos, "8.5x11", jobId),
      generatePDF(photos, "12x12", jobId),
    ]);

    // Update job with PDF URLs
    await sql`
      UPDATE jobs
      SET 
        pdf_url = ${pdfUrls[0]},
        pdf_url_square = ${pdfUrls[1]},
        pdf_url_large = ${pdfUrls[2]},
        status = 'completed',
        updated_at = NOW()
      WHERE id = ${jobId}
    `;

    return Response.json({
      success: true,
      pdfs: {
        standard: pdfUrls[0],
        square: pdfUrls[1],
        large: pdfUrls[2],
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return Response.json({ error: "Failed to generate PDFs" }, { status: 500 });
  }
}

/**
 * Generate a single PDF for a specific size
 */
async function generatePDF(photos, size, jobId) {
  const html = buildAlbumHTML(photos, size);
  const styles = getAlbumStyles(size);

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/integrations/pdf-generation/pdf`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: { html },
        styles: [{ content: styles }],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`PDF generation failed for size ${size}`);
  }

  // Get the PDF as a buffer
  const pdfBuffer = await response.arrayBuffer();

  // Upload the PDF to get a permanent URL
  const uploadResponse = await fetch(
    `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/_create/api/upload/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: Buffer.from(pdfBuffer),
    },
  );

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload PDF for size ${size}`);
  }

  const { url } = await uploadResponse.json();
  return url;
}

/**
 * Build the HTML structure for the photo album
 */
function buildAlbumHTML(photos, size) {
  const dimensions = getSizeDimensions(size);
  const photosPerPage = size === "8.5x11" ? 1 : 1; // One photo per page for all sizes

  let pagesHTML = "";

  // Title page
  pagesHTML += `
    <div class="page title-page">
      <div class="title-content">
        <h1>Your Wedding Album</h1>
        <p class="subtitle">Curated by Marco</p>
        <div class="ornament">❦</div>
      </div>
    </div>
  `;

  // Photo pages
  photos.forEach((photo, index) => {
    pagesHTML += `
      <div class="page photo-page">
        <div class="photo-container">
          <img src="${photo.download_url}" alt="${photo.filename || `Photo ${index + 1}`}" />
        </div>
      </div>
    `;
  });

  // End page
  pagesHTML += `
    <div class="page end-page">
      <div class="end-content">
        <p class="end-text">The end of one chapter,<br/>the beginning of forever.</p>
        <div class="ornament">❦</div>
        <p class="signature">— Marco Memorio</p>
      </div>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Wedding Album - ${size}</title>
    </head>
    <body>
      ${pagesHTML}
    </body>
    </html>
  `;
}

/**
 * Get CSS styles for the album based on size
 */
function getAlbumStyles(size) {
  const dimensions = getSizeDimensions(size);

  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Crimson Text', 'Georgia', serif;
      color: #2a2a2a;
      background: #ffffff;
    }

    .page {
      width: ${dimensions.width};
      height: ${dimensions.height};
      page-break-after: always;
      position: relative;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: ${dimensions.padding};
    }

    .page:last-child {
      page-break-after: auto;
    }

    /* Title Page */
    .title-page {
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      color: #f5f5f0;
    }

    .title-content {
      text-align: center;
    }

    .title-page h1 {
      font-size: ${dimensions.titleSize};
      font-weight: 400;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
      font-family: 'Crimson Text', serif;
    }

    .subtitle {
      font-size: ${dimensions.subtitleSize};
      font-style: italic;
      opacity: 0.9;
      margin-bottom: 2rem;
    }

    .ornament {
      font-size: ${dimensions.ornamentSize};
      opacity: 0.7;
    }

    /* Photo Pages */
    .photo-page {
      flex-direction: column;
      background: #fafaf8;
    }

    .photo-container {
      width: 100%;
      height: ${dimensions.photoHeight};
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: ${dimensions.captionMargin};
    }

    .photo-container img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }

    /* End Page */
    .end-page {
      background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
      color: #f5f5f0;
    }

    .end-content {
      text-align: center;
    }

    .end-text {
      font-size: ${dimensions.endTextSize};
      font-style: italic;
      line-height: 1.8;
      margin-bottom: 2rem;
    }

    .signature {
      font-size: ${dimensions.signatureSize};
      margin-top: 2rem;
      opacity: 0.9;
    }

    @media print {
      .page {
        page-break-after: always;
      }
      
      body {
        margin: 0;
        padding: 0;
      }
    }
  `;
}

/**
 * Get dimensions and sizing for different album sizes
 */
function getSizeDimensions(size) {
  const sizes = {
    "8x8": {
      width: "8in",
      height: "8in",
      padding: "0.75in",
      titleSize: "3rem",
      subtitleSize: "1.5rem",
      ornamentSize: "2rem",
      photoHeight: "85%",
      captionMargin: "1rem",
      captionSize: "0.95rem",
      endTextSize: "1.25rem",
      signatureSize: "1rem",
    },
    "8.5x11": {
      width: "8.5in",
      height: "11in",
      padding: "1in",
      titleSize: "3.5rem",
      subtitleSize: "1.75rem",
      ornamentSize: "2.5rem",
      photoHeight: "80%",
      captionMargin: "1.25rem",
      captionSize: "1rem",
      endTextSize: "1.5rem",
      signatureSize: "1.1rem",
    },
    "12x12": {
      width: "12in",
      height: "12in",
      padding: "1.25in",
      titleSize: "4rem",
      subtitleSize: "2rem",
      ornamentSize: "3rem",
      photoHeight: "85%",
      captionMargin: "1.5rem",
      captionSize: "1.1rem",
      endTextSize: "1.75rem",
      signatureSize: "1.25rem",
    },
  };

  return sizes[size] || sizes["8x8"];
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
