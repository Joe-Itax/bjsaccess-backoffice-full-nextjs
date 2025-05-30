import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
   "http://127.0.0.1:5500",
  "https://bjsaccess.com",
  "https://bjsaccess.vercel.app",
  "https://bjsaccess-back-office.vercel.app",
  "https://bjsaccess-backoffice.vercel.app",
];

export function corsMiddleware(req: NextRequest) {
  const origin = req.headers.get("origin");

  // === CORS LOGGER ===
  if (origin) {
    console.log(`[CORS-LOGGER] Requête reçue depuis l'origine: ${origin}`);
  } else {
    console.log(
      `[CORS-LOGGER] Requête sans origine (probablement interne ou serveur)`
    );
  }

  const isAllowed = !origin || allowedOrigins.includes(origin);
  const response = NextResponse.next();

  if (isAllowed) {
    response.headers.set("Access-Control-Allow-Origin", origin ?? "*");
  } else {
    console.warn(`❌ CORS bloqué pour l'origine: ${origin}`);
  }

  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept, Set-Cookie"
  );
  response.headers.set(
    "Access-Control-Expose-Headers",
    "set-cookie, x-auth-token"
  );

  // Répondre aux requêtes preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 200, headers: response.headers });
  }

  return response;
}
