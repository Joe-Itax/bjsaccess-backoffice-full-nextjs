import { NextRequest } from "next/server";
import { corsMiddleware } from "@/lib/middlewares/cors";

export function middleware(req: NextRequest) {
  return corsMiddleware(req);
}

// === CONFIG DE MATCHING ===
export const config = {
  matcher: ["/api/:path*"], // toutes les routes sous /api/
};
