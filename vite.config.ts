
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

export default defineConfig({
  plugins: [
    sanitizeHtmlPlugin(), 
    react()
  ],
  server: {
    hmr: {
      overlay: false
    }
  }
});
