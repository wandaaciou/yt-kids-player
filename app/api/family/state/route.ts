import { NextRequest, NextResponse } from "next/server";
import { getFamilyState, patchPlayerControl } from "../supabase";

export async function GET() {
  try {
    return NextResponse.json(await getFamilyState());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load state." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json(await patchPlayerControl(body));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update state." },
      { status: 500 },
    );
  }
}
