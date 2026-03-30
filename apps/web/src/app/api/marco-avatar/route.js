export async function GET(request) {
  // Marco's avatar URL (generated image)
  const avatarUrl =
    "https://raw.createusercontent.com/8b90a64e-fee9-4d3a-934f-cf9fc25f5aec/";

  return Response.json({ avatarUrl });
}
