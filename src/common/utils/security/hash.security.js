import { compare, genSalt, hash } from "bcrypt";
import { SALT_ROUND } from "../../../../config/config.service.js";
import * as argon2 from "argon2";
import { HashApproachEnum } from "../../enums/security.enum.js";

export const generateHash = async ({
  plainText,
  salt = SALT_ROUND,
  minor = "b",
  approch = HashApproachEnum.bcrypt,
} = {}) => {
  let hashValue;
  switch (approch) {
    case HashApproachEnum.argon2:
      hashValue = await argon2.hash(plainText);
      break;

    default:
      const generatedSalt = await genSalt(salt, minor);
      hashValue = await hash(plainText, generatedSalt);
      break;
  }
  return hashValue;
};

export const compareHash = async ({
  plainText,
cipherText,
  minor = "b",
  approch = HashApproachEnum.bcrypt,
} = {}) => {
  let match=false;
  switch (approch) {
    case HashApproachEnum.argon2:
      match = await argon2.verify(cipherText,plainText);
      break;

    default:
      // const generatedSalt = await compare(plainText, cipherText);
      match = await compare(plainText, cipherText);
      break;
  }
  return match;
};
