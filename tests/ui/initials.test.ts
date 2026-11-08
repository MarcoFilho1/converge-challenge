import { describe, expect, it } from "vitest";
import { initialsOf } from "@/components/ui/severity-badge";

describe("iniciais do avatar", () => {
  it("usa só letras: ignora emoji, parênteses e números do nome do perfil do WhatsApp", () => {
    expect(initialsOf("Jurado Teste (demo)")).toBe("JT");
    expect(initialsOf("Marco 🙂")).toBe("MA");
    expect(initialsOf("🙂 Ana Lima")).toBe("AL");
    expect(initialsOf("Colaborador 4321")).toBe("CO");
    expect(initialsOf("Érica Souza")).toBe("ÉS");
  });

  it("sem letra nenhuma, usa um ponto de interrogação", () => {
    expect(initialsOf("🙂🙂")).toBe("?");
  });
});
