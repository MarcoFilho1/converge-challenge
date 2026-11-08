import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth/session";

export default async function RootPage() {
  const cookieStore = await cookies();
  if (isAuthenticated(cookieStore)) {
    redirect("/fila");
  }
  redirect("/login");
}
