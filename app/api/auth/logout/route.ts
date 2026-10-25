import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { env } from "@/lib/env";

/** POST-only (a GET logout could be triggered cross-site by an <img>). 303 → GET /. */
export async function POST() {
  await destroySession();
  return NextResponse.redirect(new URL("/", env().APP_URL), 303);
}
