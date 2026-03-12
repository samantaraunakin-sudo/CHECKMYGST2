
export function calculateGSTSummary(sales, purchases) {

  const salesGST = sales.reduce((sum, inv) => {
    return sum + (inv.totalGST || 0);
  }, 0);

  const purchaseGST = purchases.reduce((sum, inv) => {
    return sum + (inv.totalGST || 0);
  }, 0);

  const netGST = salesGST - purchaseGST;

  return {
    salesGST,
    purchaseGST,
    netGST
  };
}

