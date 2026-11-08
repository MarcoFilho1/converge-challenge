"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE } from "@/lib/auth/session";

const LoginInputSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail ou CRM"),
  password: z.string().trim().min(1, "Informe a senha de acesso"),
});

export async function login(formData: FormData): Promise<void> {
  const parsed = LoginInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/login?erro=campos_obrigatorios");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 horas
  });

  redirect("/conexao");
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
