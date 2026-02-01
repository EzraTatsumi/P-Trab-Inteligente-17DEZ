interface IElectronAPI {
  ping: () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

export {};