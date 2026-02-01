import { app, BrowserWindow, shell, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

// Determina o diretório atual para uso com módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função para criar a janela principal
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    title: 'PTrab Inteligente',
  });

  // Carrega o arquivo index.html do build do Vite
  const indexHtmlPath = path.join(__dirname, 'index.html');
  mainWindow.loadFile(indexHtmlPath);

  // Abre o DevTools se estiver em modo de desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Lida com links externos
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// Quando o Electron estiver pronto
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // Recria a janela no macOS quando o dock icon é clicado e não há janelas abertas
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Fecha o aplicativo quando todas as janelas estiverem fechadas (exceto no macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Exemplo de comunicação IPC (opcional, mas útil para futuras integrações)
ipcMain.on('ping', () => console.log('pong'));