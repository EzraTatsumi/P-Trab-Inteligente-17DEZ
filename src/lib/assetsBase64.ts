// src/lib/assetsBase64.ts
import logoUrl from '../assets/logo.png'; 

// Isso vai nos ajudar a debugar:
if (typeof window !== 'undefined') {
  console.log("DEBUG: O caminho da logo é:", logoUrl);
}

export const LOGO_MD_BASE64 = logoUrl;