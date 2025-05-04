import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: Request) {
  // Placeholder implementation – returns dummy text so that Recording UI works.
  // Actual STT logic will be implemented in Step 3.
  const formData = await request.formData();
  if (!formData.get("file")) {
    return NextResponse.json(
      { error: "file field missing" },
      { status: 400 }
    );
  }
  return NextResponse.json({ text: "(transcript will appear here)" });
}
