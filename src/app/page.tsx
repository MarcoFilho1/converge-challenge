import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth/session";

/** Lê o cookie dentro de <Suspense>: com cacheComponents, cookies() fora dele quebra o next build. */
async function RedirectByAuth() {
  const cookieStore = await cookies();
  redirect(isAuthenticated(cookieStore) ? "/fila" : "/login");
  return null;
}

export default function RootPage() {
  return (
    <Suspense fallback={null}>
      <RedirectByAuth />
    </Suspense>
  );
}
