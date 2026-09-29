import { redisClient } from "../../DB/redis.connection.db.js";

export const baseRevokeTokenKey = (userId) => `RevokeToken::${userId}`;
export const revokeTokenKey = ({ userId, jti }) => `${baseRevokeTokenKey(userId)}::${jti}`;

export const set = async ({ key, value, ttl } = {}) => {
	const data = typeof value === "string" ? value : JSON.stringify(value);
	return ttl ? redisClient.set(key, data, { EX: ttl }) : redisClient.set(key, data);
};

export const update = async ({ key, value, ttl } = {}) => {
	if (!(await redisClient.exists(key))) return 0;
	return set({ key, value, ttl });
};

export const increment = async (key) => {
	if (!(await redisClient.exists(key))) return 0;
	return redisClient.incr(key);
};

export const get = async (key) => {
	const value = await redisClient.get(key);
	if (value === null) return null;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
};

export const ttl = (key) => redisClient.ttl(key);
export const exists = (key) => redisClient.exists(key);
export const expire = ({ key, ttl: seconds } = {}) => redisClient.expire(key, seconds);
export const mGet = (keys = []) => keys.length ? redisClient.mGet(keys) : [];
export const keys = (prefix) => redisClient.keys(`${prefix}*`);

export const deleteKey = (key) => {
	const keysToDelete = Array.isArray(key) ? key : [key];
	return keysToDelete.length ? redisClient.del(keysToDelete) : 0;
};

// Temporary compatibility alias for callers still using the old spelling.
export const baseRevokTokenKey = baseRevokeTokenKey;