import { NextResponse } from "next/server";

import { listCorpora, createCorpus } from "../../../lib/rag-corpus";

export const runtime = "nodejs";

const PROJECT_ID = process.env.GCP_PROJECT_ID;

function missingProject() {
  return NextResponse.json(
    { error: "GCP_PROJECT_ID env is missing" },
    { status: 500 },
  );
}

export async function GET(): Promise<NextResponse> {
  if (!PROJECT_ID) return missingProject();

  try {
    const corpora = await listCorpora(PROJECT_ID);
    return NextResponse.json({ corpora });
  } catch (error) {
    console.error("/api/corpora GET error", error);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!PROJECT_ID) return missingProject();

  try {
    const { displayName, description } = (await req.json()) as {
      displayName?: string;
      description?: string;
    };

    if (!displayName) {
      return NextResponse.json(
        { error: "displayName is required" },
        { status: 400 },
      );
    }

    const corpus = await createCorpus({
      projectId: PROJECT_ID,
      displayName,
      description,
    });

    return NextResponse.json({ corpus }, { status: 201 });
  } catch (error) {
    console.error("/api/corpora POST error", error);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
