import { type NextRequest } from "next/server";
import { getSyncJob } from "@/lib/sync-queue";

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) return Response.json({ error: "No jobId" }, { status: 400 });

  const job = await getSyncJob(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  return Response.json(job);
}
