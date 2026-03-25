import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (
        _pathname,
        _clientPayload,
        _multipart
      ) => {
        // Only allow image types -- no HEIC should reach here (converted client-side)
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: 5 * 1024 * 1024, // 5MB safety margin after compression
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // NOTE: This callback does NOT work in local dev (Vercel cannot reach localhost).
        // Database update is handled client-side via server action instead.
        console.log("Upload completed:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
