export function categoryTotals(expenses: { category: string; amount: number | string }[]) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + Math.round(Number(expense.amount) * 100));
  }
  return [...totals].map(([category, cents]) => ({ category, amount: cents / 100 })).sort((a, b) => b.amount - a.amount);
}