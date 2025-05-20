// import { auth } from "@/lib/auth";
import { authClient } from "../auth-client";

export async function requireRole(req: Request, role: "ADMIN" | "AUTHOR") {
  //   const session = await auth.api.getSession(req);
  const { data: session } = await authClient.getSession();

  if (!session || session.user.role !== role) {
    return new Response("Unauthorized", { status: 403 });
  }

  return null; // tout va bien
}
