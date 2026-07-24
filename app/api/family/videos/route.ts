import { NextRequest, NextResponse } from "next/server";
import { addAllowedVideo, removeAllowedVideo } from "../supabase";

export async function POST(request: NextRequest) {
  try {
    const video = await request.json();
    return NextResponse.json(await addAllowedVideo(video));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add video." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const videoId = request.nextUrl.searchParams.get("id");

    if (!videoId) {
      return NextResponse.json({ error: "Missing video id." }, { status: 400 });
    }

    return NextResponse.json(await removeAllowedVideo(videoId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove video." },
      { status: 500 },
    );
  }
}
