import crypto from 'crypto';
import { ENC_KEY_BASE64, LEGACY_ENC_BYTE } from '../../../../config/config.service.js';

const decodeKey = (base64Key) => {
  if (!base64Key) return undefined;
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== base64Key.replace(/=+$/, '')) {
    throw new Error('ENC_KEY_BASE64 must be a valid base64-encoded 32-byte key');
  }
  return key;
};

const getCurrentKey = () => {
  const key = decodeKey(ENC_KEY_BASE64);
  if (!key) throw new Error('Configure ENC_KEY_BASE64 with a random 32-byte key before using encryption');
  return key;
};

const getLegacyKey = () => {
  if (!LEGACY_ENC_BYTE) return undefined;
  const key = Buffer.from(LEGACY_ENC_BYTE, 'utf8');
  if (key.length !== 32) throw new Error('LEGACY_ENC_BYTE must match the original 32-byte encryption key');
  return key;
};

export const encrypt = (text) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getCurrentKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export const decrypt = (encryptedData) => {
  const [version, ivText, tagText, ciphertextText] = encryptedData.split(':');
  if (version === 'v2') {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getCurrentKey(), Buffer.from(ivText, 'base64'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  const legacyKey = getLegacyKey();
  if (!legacyKey) throw new Error('Legacy encrypted data requires LEGACY_ENC_BYTE during migration');
  const [legacyIv, legacyCiphertext] = encryptedData.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', legacyKey, Buffer.from(legacyIv, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(legacyCiphertext, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
