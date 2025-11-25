import CryptoJS from 'crypto-js';

const SECRET_KEY = 'ptrab-inteligente-secret-key'; // Chave de derivação (salt)

/**
 * Criptografa um objeto JavaScript em uma string usando AES.
 * @param data O objeto a ser criptografado.
 * @param password A senha fornecida pelo usuário.
 * @returns A string criptografada.
 */
export const encryptData = (data: any, password: string): string => {
  const jsonString = JSON.stringify(data);
  
  // Usa a senha e uma chave secreta (salt) para derivar a chave de criptografia
  const key = CryptoJS.PBKDF2(password, SECRET_KEY, { keySize: 256 / 32, iterations: 1000 });
  
  const encrypted = CryptoJS.AES.encrypt(jsonString, key.toString());
  return encrypted.toString();
};

/**
 * Descriptografa uma string criptografada de volta para um objeto JavaScript.
 * @param encryptedText A string criptografada.
 * @param password A senha fornecida pelo usuário.
 * @returns O objeto descriptografado ou null se a descriptografia falhar.
 */
export const decryptData = (encryptedText: string, password: string): any | null => {
  try {
    const key = CryptoJS.PBKDF2(password, SECRET_KEY, { keySize: 256 / 32, iterations: 1000 });
    
    const decrypted = CryptoJS.AES.decrypt(encryptedText, key.toString());
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!jsonString) {
      // Se a string for vazia, a senha provavelmente está errada
      return null;
    }
    
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Erro durante a descriptografia:", e);
    return null;
  }
};