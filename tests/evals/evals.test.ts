import { beforeAll, describe, expect, it } from "vitest";
import { pushSchemaToTestDb } from "../helpers/db";

beforeAll(() => pushSchemaToTestDb());

describe("evals de segurança", () => {
  it("passam nos três blocos: origem, termos e crise", async () => {
    const { runEvals } = await import("@/lib/evals/run");
    const report = await runEvals();
    expect(report.origem).toMatchObject({ ok: true, semOrigem: 0 });
    expect(report.origem.indicios).toBeGreaterThan(0);
    expect(report.termos).toMatchObject({ ok: true, violacoes: [] });
    expect(report.termos.resumos).toBeGreaterThanOrEqual(20);
    expect(report.crise).toMatchObject({ ok: true, perdidas: [] });
    expect(report.crise.total).toBeGreaterThanOrEqual(15);
  }, 120000);
});
