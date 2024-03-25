import { lucia, validateRequest } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const { user } = await validateRequest();

  if (user) await lucia.invalidateUserSessions(user.id);

  redirect("/");
}
