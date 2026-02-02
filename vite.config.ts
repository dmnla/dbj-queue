
import { defineConfig, PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

const sanitizeHtmlPlugin = (): PluginOption => ({
  name: 'sanitize-html',
  enforce: 'pre' as const, // Fix: Cast to specific string literal type
  transformIndexHtml(html: string) { // Fix: Add explicit type for html
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
