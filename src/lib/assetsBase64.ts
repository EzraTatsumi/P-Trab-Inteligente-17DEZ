// src/lib/assetsBase64.ts

/** * Agora que a logo está na pasta /public, o navegador 
 * a encontrará diretamente na raiz do servidor.
 */
export const LOGO_MD_BASE64 = "/logo.jpg";

// Log para confirmar que o código está rodando
if (typeof window !== 'undefined') {
  console.log("LOG: Logo configurada para:", LOGO_MD_BASE64);
}