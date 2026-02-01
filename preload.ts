import { contextBridge, ipcRenderer } from 'electron';

// Expondo APIs seguras para o frontend
contextBridge.exposeInMainWorld('electronAPI', {
  // Exemplo de função IPC
  ping: () => ipcRenderer.send('ping'),
  
  // Adicione outras APIs do Electron aqui, se necessário (ex: salvar arquivo, notificação)
});