import { NextRequest } from "next/server";
import { transcriptProvider } from "@/lib/chacotero/services";
import { chacoteroErrorResponse } from "@/lib/chacotero/api-helpers";
import { VideoSource } from "@/lib/chacotero/types";

export async function POST(req: NextRequest) {
  try {
    const { source } = (await req.json()) as { source: VideoSource };
    const transcript = await transcriptProvider.getTranscript(source);
    return Response.json({ transcript });
  } catch (error) {
    return chacoteroErrorResponse(error);
  }
}
