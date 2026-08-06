import { NextResponse } from "next/server";
import { ComplaintCategory, ComplaintStatus } from "@/generated/prisma/enums";
import { clientIp, limitOr429 } from "@/lib/ratelimit";
import { listMapPins, listWardBoundaries } from "@/features/public-site/map";

/**
 * The map's data, for anonymous visitors. Everything it returns has already been through
 * `listMapPins`, which is where the privacy rules live — jittered coordinates, no names,
 * no descriptions, private complaints excluded.
 */
export const revalidate = 300;

export async function GET(request: Request) {
  const limited = await limitOr429(
    `public-api:${clientIp(request)}`,
    60,
    60_000,
    "Too many requests — try again shortly.",
  );
  if (limited) return limited;

  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const category = params.get("category");

  const [pins, wards] = await Promise.all([
    listMapPins({
      status: status && status in ComplaintStatus ? (status as ComplaintStatus) : undefined,
      category:
        category && category in ComplaintCategory ? (category as ComplaintCategory) : undefined,
    }),
    listWardBoundaries(),
  ]);

  return NextResponse.json(
    { data: { pins, wards }, meta: { count: pins.length } },
    { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
