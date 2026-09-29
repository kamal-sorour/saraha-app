import joi from "joi";
import { Types } from "mongoose";

export const generalValidationFields = {
  otp: joi.string().pattern(/^\d{6}$/),
  username: joi.string().pattern(/^[A-Z][a-z]{1,24}\s[A-Z][a-z]{1,24}$/).min(2).max(51),
  email: joi.string().email({ minDomainSegments: 2, maxDomainSegments: 3, tlds: { allow: ["com", "net", "edu"] } }),
  password: joi.string().pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*\W).{8,16}$/),
  confirmPassword: (path = "password") => joi.string().valid(joi.ref(path)),
  phone: joi.string(),
  flag: joi.boolean().truthy("true", "1").falsy("false", "0"),
  id: joi.string().custom((value, helper) => (
    Types.ObjectId.isValid(value) ? value : helper.message("Invalid objectId")
  )),
  file: (validation = []) => joi.object({
    fieldname: joi.string().required(),
    originalname: joi.string().required(),
    encoding: joi.string().required(),
    mimetype: joi.string().valid(...validation).required(),
    finalPath: joi.string().required(),
    destination: joi.string().required(),
    filename: joi.string().required(),
    path: joi.string().required(),
    size: joi.number().required(),
  }),
};
