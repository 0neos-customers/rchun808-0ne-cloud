import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const VALID_TOKEN = process.env.DOWNLOAD_TOKEN || "";
const ZIP_FILENAME = "0ne.zip";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  // No token or wrong token → 404 (looks like the page doesn't exist)
  if (!token || !VALID_TOKEN || token !== VALID_TOKEN) {
    return new NextResponse(null, { status: 404 });
  }

  const zipPath = join(process.cwd(), "private", ZIP_FILENAME);

  if (!existsSync(zipPath)) {
    return NextResponse.json(
      { error: "Download not available — template file not found on server" },
      { status: 503 }
    );
  }

  const fileBuffer = await readFile(zipPath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${ZIP_FILENAME}"`,
      "Content-Length": fileBuffer.length.toString(),
      "Cache-Control": "no-store",
    },
  });
}
