
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const sanitizeHtmlPlugin = (): Plugin => ({
  name: 'sanitize-html',
  enforce: 'pre' as const, // 'as const' fixes the literal type mismatch error
  transformIndexHtml(html: string) {
    let cleanHtml = html.replace(/<script type="importmap">[\s\S]*?<\/script>/gi, '');
    cleanHtml = cleanHtml.replace(/<script type="module" src="https:\/\/esm\.sh\/.*"><\/script>/gi, '');
    return cleanHtml;
  },
});

const dealposProxyPlugin = (): Plugin => ({
  name: 'dealpos-proxy',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url && req.url.startsWith('/api/dealpos')) {
        try {
          const urlObj = new URL(req.url, 'http://localhost');
          const branch = urlObj.searchParams.get('branch') || 'mk';
          const outletId = branch === 'pik' 
            ? '3e6535c2-440b-4d47-aab0-9c6687617c4b' 
            : '410ba2b7-8eff-4759-b5f1-cf47b33ef1cc';

          const clientId = process.env.VITE_DEALPOS_CLIENT_ID || process.env.DEALPOS_CLIENT_ID;
          const clientSecret = process.env.VITE_DEALPOS_CLIENT_SECRET || process.env.DEALPOS_CLIENT_SECRET;

          if (!clientId || !clientSecret) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              error: "DEALPOS client credentials are not configured in environment variables.",
              debug: {
                has_clientId: !!clientId,
                has_clientSecret: !!clientSecret,
                env_keys: Object.keys(process.env).filter(k => k.toLowerCase().includes('dealpos'))
              }
            }));
            return;
          }

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
            res.statusCode = tokenRes.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: `Dealpos OAuth failed with status ${tokenRes.status}`,
              details: errText
            }));
            return;
          }

          const tokenData = (await tokenRes.json()) as any;
          const token = tokenData.Token || tokenData.token || tokenData.access_token;
          if (!token) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: "No token found in OAuth response from Dealpos",
              data: tokenData
            }));
            return;
          }

          // 2. Fetch Parked Orders
          const ordersRes = await fetch(
            `https://dailybike.dealpos.net/api/v3/ParkedOrderDisplay/Default?PageNumber=1&PageSize=50&OutletID=${outletId}`,
            {
              headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/json",
              },
            }
          );

          if (!ordersRes.ok) {
            const errText = await ordersRes.text();
            res.statusCode = ordersRes.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: `Dealpos fetch orders failed with status ${ordersRes.status}`,
              details: errText
            }));
            return;
          }

          const ordersData = await ordersRes.json();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(ordersData));

        } catch (error: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: error.message || "Unknown proxy error",
          }));
        }
        return;
      }
      next();
    });
  }
});

export default defineConfig({
  plugins: [
    sanitizeHtmlPlugin(), 
    react(),
    dealposProxyPlugin()
  ],
  server: {
    hmr: {
      overlay: false
    }
  }
});
