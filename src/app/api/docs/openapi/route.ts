import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
  const filePath = path.join(process.cwd(), "docs", "openapi.yaml");
  const content = await readFile(filePath, "utf-8");
  return new NextResponse(content, { headers: { "Content-Type": "application/yaml" } });
}
