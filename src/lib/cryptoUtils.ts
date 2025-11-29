import CryptoJS from 'crypto-js';

const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'default-secret-key';

export const encryptData = (data: any): string => {
  const dataString = JSON.stringify(data);
  return CryptoJS.AES.encrypt(dataString, SECRET_KEY).toString();
};

export const decryptData = (ciphertext: string): any | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedData) return null;
    return JSON.parse(decryptedData);
  } catch (e) {
    console.error("Decryption failed:", e);
    return null;
  }
};