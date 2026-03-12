
"use client";
import React, { useEffect, useState } from "react";

export default function GSTSummary() {

  const [salesGST, setSalesGST] = useState(0);
  const [purchaseGST, setPurchaseGST] = useState(0);
  const [netGST, setNetGST] = useState(0);

  useEffect(() => {

    async function loadGST() {
      const res = await fetch("/api/gst-summary");
      const data = await res.json();

      setSalesGST(data.salesGST || 0);
      setPurchaseGST(data.purchaseGST || 0);
      setNetGST(data.netGST || 0);
    }

    loadGST();

  }, []);

  return (

    <div style={{
      background:"#fff",
      padding:"20px",
      borderRadius:"12px",
      marginBottom:"20px"
    }}>

      <h2>GST Summary</h2>

      <p>Sales GST Collected</p>
      <h3 style={{color:"#2563EB"}}>₹{salesGST.toLocaleString("en-IN")}</h3>

      <p>Purchase GST Credit</p>
      <h3 style={{color:"#16A34A"}}>₹{purchaseGST.toLocaleString("en-IN")}</h3>

      <p>Net GST Payable</p>
      <h2 style={{color:"#EF4444"}}>₹{netGST.toLocaleString("en-IN")}</h2>

    </div>

  );
}

