interface IElectronAPI {
  ping: () => void;
  // Adicione aqui as assinaturas de outras funções que você expuser
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

export {};