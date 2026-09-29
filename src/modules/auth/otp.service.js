import { randomInt } from "node:crypto";
import { compareHash, conflictException, generateHash } from "../../common/utils/index.js";
import { redisClient } from "../../DB/redis.connection.db.js";
import { enqueueEmail } from "../../common/utils/email/email.queue.js";
import { emailTemplate } from "../../common/utils/email/template.email.js";
import { EmailEnum } from "../../common/enums/index.js";

export const OTP_TTL_SECONDS = 120;
export const OTP_MAX_SENDS = 3;
export const OTP_MAX_FAILURES = 5;
export const OTP_WINDOW_SECONDS = 300;

export const otpKeys = ({ email, type = EmailEnum.ConfirmEmail }) => {
  const prefix = `OTP::User::${email.trim().toLowerCase()}::${type}`;
  return {
    code: prefix,
    requests: `${prefix}::Request`,
    failures: `${prefix}::Failures`,
    blocked: `${prefix}::Blocked`,
  };
};

const ISSUE_OTP_SCRIPT = `
  local blockedTtl = redis.call('TTL', KEYS[4])
  if blockedTtl > 0 then return {-1, blockedTtl} end
  local currentTtl = redis.call('TTL', KEYS[1])
  if currentTtl > 0 then return {0, currentTtl} end
  local sends = redis.call('INCR', KEYS[2])
  if sends == 1 then redis.call('EXPIRE', KEYS[2], ARGV[2]) end
  if sends > tonumber(ARGV[3]) then
    redis.call('SET', KEYS[4], '1', 'EX', ARGV[4])
    redis.call('DEL', KEYS[2])
    return {-1, tonumber(ARGV[4])}
  end
  redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[5])
  redis.call('DEL', KEYS[3])
  return {1, tonumber(ARGV[5])}
`;

const RECORD_FAILURE_SCRIPT = `
  if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
  local failures = redis.call('INCR', KEYS[2])
  if failures == 1 then redis.call('EXPIRE', KEYS[2], ARGV[2]) end
  if failures >= tonumber(ARGV[1]) then
    redis.call('DEL', KEYS[1], KEYS[2])
    redis.call('SET', KEYS[3], '1', 'EX', ARGV[3])
    return -1
  end
  return failures
`;

const CONSUME_OTP_SCRIPT = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
  redis.call('DEL', KEYS[1], KEYS[2])
  return 1
`;

const ROLLBACK_OTP_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('DEL', KEYS[1]) end
  return 1
`;

export const createOtpService = ({
  redis = redisClient,
  hash = generateHash,
  compare = compareHash,
  enqueue = enqueueEmail,
} = {}) => {
  const issue = async ({ email, type = EmailEnum.ConfirmEmail, title = "Verify Account" }) => {
    const keys = otpKeys({ email, type });
    const code = String(randomInt(100000, 1_000_000));
    const hashedCode = await hash({ plainText: code });
    const result = await redis.eval(ISSUE_OTP_SCRIPT, {
      keys: [keys.code, keys.requests, keys.failures, keys.blocked],
      arguments: [hashedCode, String(OTP_WINDOW_SECONDS), String(OTP_MAX_SENDS), String(OTP_WINDOW_SECONDS), String(OTP_TTL_SECONDS)],
    });

    const [status, retryAfter] = result.map(Number);
    if (status === 0) {
      throw conflictException({ message: `A code was already sent. Try again in ${retryAfter} seconds.` });
    }
    if (status < 0) {
      throw conflictException({ message: `Too many OTP requests. Try again in ${retryAfter} seconds.` });
    }

    try {
      await enqueue({
        to: email,
        subject: type,
        html: emailTemplate({ code, title }),
        text: `${title}: your verification code is ${code}`,
      });
    } catch (error) {
      await redis.eval(ROLLBACK_OTP_SCRIPT, {
        keys: [keys.code],
        arguments: [hashedCode],
      });
      throw error;
    }
  };

  const verify = async ({ email, otp, type = EmailEnum.ConfirmEmail, consume = false }) => {
    const keys = otpKeys({ email, type });
    const hashedCode = await redis.get(keys.code);
    if (!hashedCode) {
      throw conflictException({ message: "OTP is expired or invalid." });
    }

    const matches = await compare({ plainText: otp, cipherText: hashedCode });
    if (!matches) {
      const failureCount = Number(await redis.eval(RECORD_FAILURE_SCRIPT, {
        keys: [keys.code, keys.failures, keys.blocked],
        arguments: [String(OTP_MAX_FAILURES), String(OTP_TTL_SECONDS), String(OTP_WINDOW_SECONDS)],
      }));
      if (failureCount === -1) {
        throw conflictException({ message: "Too many invalid OTP attempts. Request a new code later." });
      }
      throw conflictException({ message: "OTP is expired or invalid." });
    }

    if (consume) {
      const consumed = Number(await redis.eval(CONSUME_OTP_SCRIPT, {
        keys: [keys.code, keys.failures],
        arguments: [hashedCode],
      }));
      if (consumed !== 1) {
        throw conflictException({ message: "OTP has already been used or expired." });
      }
    }
    return true;
  };

  return { issue, verify };
};

const otpService = createOtpService();
export const issueOtp = otpService.issue;
export const verifyOtp = otpService.verify;
