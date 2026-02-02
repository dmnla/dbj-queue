import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const sanitizeHtmlPlugin = (): Plugin => ({
  name: 'sanitize-html',
  enforce: 'pre',
  transformIndexHtml(html: string) {
    // 1. Remove the broken ImportMap block completely
    let cleanHtml = html.replace(/<script type="importmap">[\s\S]*?<\/script>/gi, '');
    
    // 2. Remove any other potential CDN injections AI Studio might add
    cleanHtml = cleanHtml.replace(/<script type="module" src="https:\/\/esm\.sh\/.*"><\/script>/gi, '');

    return cleanHtml;
  },
});

export default defineConfig({
  plugins: [
    sanitizeHtmlPlugin(), // Run our cleaner first
    react()
  ],
  server: {
    hmr: {
      overlay: false // Disable the "Crash Screen" overlay to prevent reload loops
    }
  }
});