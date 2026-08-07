import { db } from "@/lib/db";

const VERSION = "0.1.0";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      {
        status: "ok",
        version: VERSION,
        timestamp: new Date().toISOString(),
        database: "connected",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[health] database check failed:", error);
    return Response.json(
      {
        status: "error",
        message: "Database unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
