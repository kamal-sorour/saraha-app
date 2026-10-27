import { config as dotenvConfig } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

dotenvConfig({ path: resolve(dirname(fileURLToPath(import.meta.url)), ".env.dev") });


export const DB_URI = process.env.DB_URI;
export const ENC_BYTE = process.env.ENC_BYTE;
export const ENC_KEY_BASE64 = process.env.ENC_KEY_BASE64;
export const LEGACY_ENC_BYTE = process.env.LEGACY_ENC_BYTE;
export const SALT_ROUND = parseInt(process.env.SALT_ROUND ?? '10')
// Number(process.env.SALT_ROUND);

export const USER_TOKEN_SECRET_KEY = process.env.USER_TOKEN_SECRET_KEY;
export const USER_REFRESH_TOKEN_SECRET_KEY = process.env.USER_REFRESH_TOKEN_SECRET_KEY;
export const System_TOKEN_SECRET_KEY = process.env.System_TOKEN_SECRET_KEY;
export const System_REFRESH_TOKEN_SECRET_KEY = process.env.System_REFRESH_TOKEN_SECRET_KEY;

export const ACCESS_EXPIRES_IN = parseInt(process.env.ACCESS_EXPIRES_IN)
export const REFRESH_EXPIRES_IN = parseInt(process.env.REFRESH_EXPIRES_IN)
export const RUDIS_URI = process.env.RUDIS_URI

export const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD
export const EMAIL_APP = process.env.EMAIL_APP
export const APPLICATION_NAME = process.env.APPLICATION_NAME
export const ORIGINS = (process.env.ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
export const GOOGLE_CLIENT_IDS = (process.env.GOOGLE_CLIENT_IDS ?? "").split(",").map((clientId) => clientId.trim()).filter(Boolean);

export const assertConfig = () => {
	const required = [
		"DB_URI",
		"RUDIS_URI",
		"ENC_KEY_BASE64",
		"USER_TOKEN_SECRET_KEY",
		"USER_REFRESH_TOKEN_SECRET_KEY",
		"System_TOKEN_SECRET_KEY",
		"System_REFRESH_TOKEN_SECRET_KEY",
		"ACCESS_EXPIRES_IN",
		"REFRESH_EXPIRES_IN",
		"EMAIL_APP",
		"EMAIL_APP_PASSWORD",
		"APPLICATION_NAME",
	];
	const missing = required.filter((key) => !process.env[key]);
	if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
	const encryptionKey = Buffer.from(process.env.ENC_KEY_BASE64, "base64");
	if (encryptionKey.length !== 32 || encryptionKey.toString("base64").replace(/=+$/, "") !== process.env.ENC_KEY_BASE64.replace(/=+$/, "")) {
		throw new Error("ENC_KEY_BASE64 must be a valid base64-encoded 32-byte key");
	}

	for (const key of ["USER_TOKEN_SECRET_KEY", "USER_REFRESH_TOKEN_SECRET_KEY", "System_TOKEN_SECRET_KEY", "System_REFRESH_TOKEN_SECRET_KEY"]) {
		if (process.env[key].length < 32) throw new Error(`${key} must contain at least 32 characters`);
	}
	for (const key of ["ACCESS_EXPIRES_IN", "REFRESH_EXPIRES_IN"]) {
		if (!Number.isSafeInteger(Number(process.env[key])) || Number(process.env[key]) <= 0) {
			throw new Error(`${key} must be a positive integer number of seconds`);
		}
	}
};

// export default config;
