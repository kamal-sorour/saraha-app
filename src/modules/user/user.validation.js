import joi from "joi";
import { GenderEnum } from "../../common/enums/user.enum.js";

export const userId = {
  params: joi.object({
    userId: joi.string().hex().length(24).required(),
  }).required(),
};

export const updateProfile = {
  ...userId,
  body: joi.object({
    firstName: joi.string().trim().min(2).max(25),
    lastName: joi.string().trim().min(2).max(25),
    gender: joi.number().valid(...Object.values(GenderEnum)),
    phone: joi.string().trim().min(5).max(32),
  }).min(1).unknown(false).required(),
};