import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const expectedToken = process.env.DOWNLOAD_TOKEN;

  if (!token || !expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const zipPath = join(process.cwd(), "private", "0ne.zip");
    if (!existsSync(zipPath)) {
      return NextResponse.json(
        { error: "Download not available — template file not found on server" },
        { status: 503 }
      );
    }
    const zipBuffer = await readFile(zipPath);

    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="0ne.zip"',
      },
    });
  } catch {
    return NextResponse.json({ error: "file not found" }, { status: 500 });
  }
}
