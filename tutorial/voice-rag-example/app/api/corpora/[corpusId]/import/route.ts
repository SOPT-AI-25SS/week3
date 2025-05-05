import { NextResponse } from "next/server";

import { importJsonl } from "../../../../../lib/rag-corpus";
import { asCorpusPath } from "../../../../../lib/as-corpus-path";

export const runtime = "nodejs";

const PROJECT_ID = process.env.GCP_PROJECT_ID;
const LOCATION = process.env.GCP_LOCATION || "us-central1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function POST(req: Request, context: any): Promise<NextResponse> {
  if (!PROJECT_ID) {
    return NextResponse.json({ error: "GCP_PROJECT_ID env missing" }, { status: 500 });
  }

  const corpusId = context?.params?.corpusId as string | undefined;
  if (!corpusId) {
    return NextResponse.json({ error: "corpusId missing in path" }, { status: 400 });
  }

  try {
    const { gcsUri, chunkSize } = (await req.json()) as {
      gcsUri?: string;
      chunkSize?: number;
    };

    if (!gcsUri) {
      return NextResponse.json({ error: "gcsUri required" }, { status: 400 });
    }

    const corpusPath = asCorpusPath(corpusId, PROJECT_ID, LOCATION);

    await importJsonl({ corpusName: corpusPath, gcsUri, chunkSize });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("/api/corpora/[id]/import error", error);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
