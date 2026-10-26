import { expect, it } from "vitest";
import { cpfDigits, formatCpf, validCpf } from "./cpf";
it("valida e normaliza CPF no cadastro", () => {
  expect(validCpf("529.982.247-25")).toBe(true);
  expect(validCpf("529.982.247-26")).toBe(false);
  expect(validCpf("111.111.111-11")).toBe(false);
  expect(validCpf("")).toBe(false);
  expect(cpfDigits("529.982.247-25")).toBe("52998224725");
  expect(formatCpf("52998224725")).toBe("529.982.247-25");
});