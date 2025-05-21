import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function requireRole(requiredRoles: string | string[]) {
  if (!Array.isArray(requiredRoles)) {
    requiredRoles = [requiredRoles];
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !requiredRoles.includes(session.user.role)) {
    return NextResponse.json(
      { message: "Vous n'êtes pas autorisé à éffectué cette action." },
      {
        status: 403,
      }
    );
  }
}
