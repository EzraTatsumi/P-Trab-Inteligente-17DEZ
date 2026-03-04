/**
 * Utilitário de Inspeção de Pré-voo (Pre-flight Check)
 * Garante que o ambiente do navegador é compatível e está atualizado.
 */

const APP_VERSION = "2.2.0"; // Incrementar em mudanças críticas de banco/esquema

export const runPreflightCheck = () => {
  if (typeof window === 'undefined') return;

  // 1. Gestão de Versão e Cache Busting
  const savedVersion = localStorage.getItem("app_ptrab_version");

  if (savedVersion && savedVersion !== APP_VERSION) {
    console.warn(`🛠️ Nova versão detectada (${APP_VERSION}). Limpando cache e reiniciando...`);
    
    // Preservamos apenas o essencial (ex: flags de tour ou ghost mode se necessário)
    // Mas para segurança total contra erros de esquema, limpamos o resto.
    const ghostMode = localStorage.getItem('is_ghost_mode');
    
    localStorage.clear();
    sessionStorage.clear();
    
    // Restaura flags de ambiente se existirem
    if (ghostMode) localStorage.setItem('is_ghost_mode', ghostMode);
    
    localStorage.setItem("app_ptrab_version", APP_VERSION);
    window.location.reload();
    return;
  } else if (!savedVersion) {
    localStorage.setItem("app_ptrab_version", APP_VERSION);
  }

  // 2. Deteção de Requisitos Mínimos
  const requirements = {
    localStorage: !!window.localStorage,
    crypto: !!window.crypto,
    fetch: !!window.fetch
  };

  const missing = Object.entries(requirements)
    .filter(([_, supported]) => !supported)
    .map(([name]) => name);

  if (missing.length > 0) {
    console.error("Navegador incompatível detectado:", missing);
    alert(`Atenção: Seu navegador não suporta recursos essenciais (${missing.join(', ')}). O P Trab Inteligente pode não funcionar corretamente.`);
  }
};