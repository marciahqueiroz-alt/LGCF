import { expect, it } from "vitest";
import { categoryTotals } from "./expense-summary";
it("separa os valores por categoria além do total", () => {
  expect(categoryTotals([{ category: "alimentacao", amount: 20.1 }, { category: "passagem", amount: 92.5 }, { category: "alimentacao", amount: 10.2 }])).toEqual([
    { category: "passagem", amount: 92.5 }, { category: "alimentacao", amount: 30.3 },
  ]);
});