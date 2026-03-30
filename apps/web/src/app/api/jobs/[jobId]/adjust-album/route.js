import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * Adjust album size by adding or removing photos
 * Allows users to hit their target album size
 */
export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = params;
    const body = await request.json();
    const { targetSize } = body;

    if (!targetSize || targetSize < 10 || targetSize > 100) {
      return Response.json(
        { error: "Target size must be between 10 and 100" },
        { status: 400 },
      );
    }

    // Verify job ownership
    const jobResult = await sql`
      SELECT user_id, selected_count
      FROM jobs
      WHERE id = ${jobId}
    `;

    if (jobResult.length === 0) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    if (String(jobResult[0].user_id) !== String(session.user.id)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const currentCount = jobResult[0].selected_count;

    if (targetSize === currentCount) {
      return Response.json({
        message: "Album is already at target size",
        currentCount,
      });
    }

    if (targetSize > currentCount) {
      // Add more photos - select from rejected photos with highest scores
      const photosToAdd = targetSize - currentCount;

      const rejectedPhotos = await sql`
        SELECT id, metadata
        FROM photo_assets
        WHERE job_id = ${jobId} AND status = 'rejected'
        ORDER BY (metadata->>'totalScore')::int DESC
        LIMIT ${photosToAdd}
      `;

      if (rejectedPhotos.length < photosToAdd) {
        return Response.json(
          {
            error: `Not enough rejected photos to add. Only ${rejectedPhotos.length} available.`,
          },
          { status: 400 },
        );
      }

      // Mark these photos as selected
      for (const photo of rejectedPhotos) {
        await sql`
          UPDATE photo_assets
          SET status = 'selected', updated_at = NOW()
          WHERE id = ${photo.id}
        `;
      }
    } else {
      // Remove photos - deselect photos with lowest scores
      const photosToRemove = currentCount - targetSize;

      const selectedPhotos = await sql`
        SELECT id, metadata
        FROM photo_assets
        WHERE job_id = ${jobId} AND status = 'selected'
        ORDER BY (metadata->>'totalScore')::int ASC
        LIMIT ${photosToRemove}
      `;

      // Mark these photos as rejected
      for (const photo of selectedPhotos) {
        await sql`
          UPDATE photo_assets
          SET status = 'rejected', updated_at = NOW()
          WHERE id = ${photo.id}
        `;
      }
    }

    // Update job selected count
    await sql`
      UPDATE jobs
      SET selected_count = ${targetSize}, updated_at = NOW()
      WHERE id = ${jobId}
    `;

    return Response.json({
      success: true,
      previousCount: currentCount,
      newCount: targetSize,
      adjusted: Math.abs(targetSize - currentCount),
    });
  } catch (error) {
    console.error("Error adjusting album size:", error);
    return Response.json(
      { error: "Failed to adjust album size" },
      { status: 500 },
    );
  }
}
