import { describe, expect, it } from "vitest";
import { exportFileSlug } from "./export-request";

describe("exportFileSlug", () => {
  it("remove acentos e símbolos do nome do arquivo", () => {
    expect(exportFileSlug("Visita cliente São Paulo / março")).toBe("visita-cliente-sao-paulo-marco");
  });
  it("devolve vazio quando não sobra nada", () => {
    expect(exportFileSlug("§§§")).toBe("");
  });
});
