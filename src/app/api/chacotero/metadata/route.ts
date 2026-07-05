import { NextRequest } from "next/server";
import { videoMetadataProvider } from "@/lib/chacotero/services";
import { chacoteroErrorResponse } from "@/lib/chacotero/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    const source = await videoMetadataProvider.getMetadata(url);
    return Response.json({ source });
  } catch (error) {
    return chacoteroErrorResponse(error);
  }
}
