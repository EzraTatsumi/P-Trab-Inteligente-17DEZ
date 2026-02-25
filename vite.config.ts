import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000, // Aumenta o limite para 1MB
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Agrupa bibliotecas pesadas de relatórios em um chunk separado
          if (id.includes('jspdf') || id.includes('exceljs') || id.includes('html2canvas')) {
            return 'vendor-reports';
          }
          // Separa a biblioteca de ícones para não pesar o carregamento inicial
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
});