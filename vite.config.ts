import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import electron from 'vite-plugin-electron/simple';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        // O arquivo principal do Electron
        entry: 'main.ts',
      },
      preload: {
        // O script de pré-carregamento
        input: path.join(__dirname, 'preload.ts'),
      },
      // Configuração para o renderer (React)
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    // Garante que o build do Vite seja compatível com o Electron
    target: 'es2020',
    outDir: 'dist',
  },
});