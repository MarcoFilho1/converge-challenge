import { describe, expect, it } from "vitest";
import { parseContactsCsv } from "@/lib/contacts/csv";

describe("parseContactsCsv (T13)", () => {
  it("processa 3 linhas válidas e aponta erro na linha com telefone inválido", () => {
    const csv = [
      "nome,telefone,setor,cargo",
      "Ana Beatriz,(81) 99811-2233,Atendimento,Analista",
      "Carlos Eduardo,abc-invalido,Operações,Técnico",
      "Fernanda Lima,5581997223344,Administrativo,Coordenadora",
      "Marcos Vinícius;81 98877-6655;Atendimento;Supervisor",
    ].join("\n");

    const result = parseContactsCsv(csv);
    expect(result.ok).toHaveLength(3);
    expect(result.ok[0]).toEqual({
      name: "Ana Beatriz",
      phone: "5581998112233",
      sector: "Atendimento",
      role: "Analista",
    });
    expect(result.ok[1]?.phone).toBe("5581997223344");
    expect(result.ok[2]?.phone).toBe("5581988776655");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.line).toBe(3);
  });
});
