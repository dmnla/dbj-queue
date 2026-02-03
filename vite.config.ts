import { defineConfig, PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

const sanitizeHtmlPlugin = (): PluginOption => ({
  name: 'sanitize-html',
  // 'as const' locks this to the specific string "pre", not just any string
  enforce: 'pre' as const, 
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