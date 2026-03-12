import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export const generateBillHTML = (invoice: any) => {

  const rows = invoice.items
    ?.map(
      (item: any) => `
<tr>
<td>${item.description || ""}</td>
<td>${item.hsn || ""}</td>
<td>${item.quantity || ""}</td>
<td>${item.rate || ""}</td>
<td>${item.totalAmount || ""}</td>
</tr>`
    )
    .join("");

  return `
<html>
<head>
<style>
body {
  font-family: Arial;
  padding: 20px;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  border: 1px solid #333;
  padding: 8px;
  text-align: center;
}
</style>
</head>

<body>

<h2>Tax Invoice</h2>

<p><b>Supplier:</b> ${invoice.supplierName || ""}</p>
<p><b>GSTIN:</b> ${invoice.supplierGSTIN || ""}</p>
<p><b>Invoice Number:</b> ${invoice.invoiceNumber || ""}</p>
<p><b>Date:</b> ${invoice.invoiceDate || ""}</p>

<table>
<tr>
<th>Description</th>
<th>HSN</th>
<th>Qty</th>
<th>Rate</th>
<th>Total</th>
</tr>

${rows}

</table>

<h3>Total GST: ₹${invoice.totalGST || 0}</h3>
<h2>Grand Total: ₹${invoice.grandTotal || 0}</h2>

</body>
</html>
`;
};

export const generatePDF = async (invoice: any) => {

  const html = generateBillHTML(invoice);

  const { uri } = await Print.printToFileAsync({
    html
  });

  return uri;
};

export const sharePDF = async (invoice: any) => {

  const uri = await generatePDF(invoice);

  await Sharing.shareAsync(uri);
};

export const printPDF = async (invoice: any) => {

  const html = generateBillHTML(invoice);

  await Print.printAsync({
    html
  });
};