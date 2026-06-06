import { IncomingMessage, ServerResponse } from "http";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const branch = req.query?.branch || "mk";
  const outletId = branch === "pik"
    ? "3e6535c2-440b-4d47-aab0-9c6687617c4b"
    : "410ba2b7-8eff-4759-b5f1-cf47b33ef1cc";

  const clientId = process.env.VITE_DEALPOS_CLIENT_ID || process.env.DEALPOS_CLIENT_ID;
  const clientSecret = process.env.VITE_DEALPOS_CLIENT_SECRET || process.env.DEALPOS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: "DEALPOS client credentials are not configured in environment variables.",
      debug: {
        has_clientId: !!clientId,
        has_clientSecret: !!clientSecret,
      }
    });
  }

  try {
    // 1. Authenticate with Dealpos
    const tokenRes = await fetch("https://dailybike.dealpos.net/api/v3/Token/Oauth2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return res.status(tokenRes.status).json({
        error: `Dealpos OAuth failed with status ${tokenRes.status}`,
        details: errText
      });
    }

    const tokenData = (await tokenRes.json()) as any;
    const token = tokenData.Token || tokenData.token || tokenData.access_token;
    if (!token) {
      return res.status(500).json({
        error: "No token found in OAuth response from Dealpos",
        data: tokenData
      });
    }

    // 2. Determine URL based on whether an invoice number is requested
    const invoiceNumber = req.query?.invoiceNumber || "";
    let targetUrl = "";
    if (invoiceNumber) {
      const cleanInvoiceNumber = String(invoiceNumber).trim().replace(/^#+/, "");
      targetUrl = `https://dailybike.dealpos.net/api/v3/Invoice/Detail?Number=${encodeURIComponent(cleanInvoiceNumber)}&OutletID=${outletId}`;
    } else {
      targetUrl = "https://dailybike.dealpos.net/api/v3/ParkedOrderDisplay/Default?PageNumber=1&PageSize=1000&OutletID={outletId}&OrderType=Parked&Sort=Desc&MaxHours=2160"
        .replace("{outletId}", outletId);
    }

    const fetchRes = await fetch(
      targetUrl,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json",
        },
      }
    );

    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      return res.status(fetchRes.status).json({
        error: `Dealpos fetch failed with status ${fetchRes.status}`,
        details: errText
      });
    }

    const responseData = await fetchRes.json();
    return res.status(200).json(responseData);

  } catch (error: any) {
    console.error("[DealPOS Proxy API Error]:", error);
    return res.status(500).json({
      error: error.message || "Unknown proxy error",
    });
  }
}
