
import { calculateGSTSummary } from "@/lib/gstCalculator";

export async function GET() {

  // temporary demo data
  const sales = [
    { totalGST: 1200 },
    { totalGST: 2400 }
  ];

  const purchases = [
    { totalGST: 800 },
    { totalGST: 600 }
  ];

  const summary = calculateGSTSummary(sales, purchases);

  return Response.json(summary);
}

