import { NextRequest, NextResponse } from "next/server";
import { saveWatchProgress } from "../supabase";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json(await saveWatchProgress(body));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update progress.",
      },
      { status: 500 },
    );
  }
}
