/**
 * Utilitário de Inspeção de Pré-voo (Log de Voo)
 * Atua como o Sentinela de entrada para garantir integridade e versão do sistema.
 */

const APP_VERSION = "2.2.0";

export const runPreflightCheck = () => {
  if (typeof window === 'undefined') return;

  // Início do agrupamento de logs com estilo militar/técnico
  console.group("%c 🛡️ P TRAB INTELIGENTE: INSPECÇÃO DE APRONTO ", "background: #0047AB; color: white; font-weight: bold; padding: 4px; border-radius: 2px;");
  
  const savedVersion = localStorage.getItem("app_ptrab_version");

  // 1. Validação de Versão e Cache Busting
  if (savedVersion && savedVersion !== APP_VERSION) {
    console.warn(`%c[SENTINELA] Desatualização detectada! (Local: ${savedVersion} | Server: ${APP_VERSION})`, "color: #ff9800; font-weight: bold;");
    console.log("[SENTINELA] Executando protocolo de limpeza profunda...");
    
    // Preservar apenas o modo ghost para não interromper missões em curso, se houver
    const ghostMode = localStorage.getItem('is_ghost_mode');
    
    localStorage.clear();
    sessionStorage.clear();
    
    if (ghostMode) localStorage.setItem('is_ghost_mode', ghostMode);
    localStorage.setItem("app_ptrab_version", APP_VERSION);
    
    console.log("%c[SENTINELA] Cache local purgado. Reiniciando subsistemas...", "color: #4caf50; font-weight: bold;");
    console.groupEnd();
    
    window.location.reload();
    return;
  } else if (!savedVersion) {
    console.log("[SENTINELA] Registro de versão inicializado.");
    localStorage.setItem("app_ptrab_version", APP_VERSION);
  } else {
    console.log(`%c[SENTINELA] Versão do Sistema: ${APP_VERSION} (Integridade OK)`, "color: #4caf50;");
  }

  // 2. Deteção de Requisitos de Hardware/Software (Navegador)
  const checks = {
    "Armazenamento Local": !!window.localStorage,
    "Motor de Criptografia": !!window.crypto,
    "Protocolo Fetch API": !!window.fetch,
    "API de Sessão": !!window.sessionStorage
  };

  console.log("%c[CHECK] Status das Capacidades do Navegador:", "font-weight: bold; text-decoration: underline;");
  
  let hasIncompatibility = false;
  Object.entries(checks).forEach(([name, supported]) => {
    if (supported) {
      console.log(`   ✅ ${name}: OPERACIONAL`);
    } else {
      console.error(`   ❌ ${name}: FALHA/BLOQUEADO`);
      hasIncompatibility = true;
    }
  });

  if (hasIncompatibility) {
    console.error("[SENTINELA] Alerta: O ambiente não atende aos requisitos mínimos de operação.");
  }

  console.log("%c[SENTINELA] Inspeção concluída. Pronto para decolagem.", "color: #0047AB; font-style: italic;");
  console.groupEnd();
};