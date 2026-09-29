import joi from 'joi';
import { generalValidationFields } from '../../common/validation/fields.js';

export const signup = {
  body: joi.object().keys({
    username: generalValidationFields.username.required(),
    email: generalValidationFields.email.trim().lowercase().required(),
    password: generalValidationFields.password.required(),
    confirmPassword: generalValidationFields.confirmPassword("password").required(),
    phone: generalValidationFields.phone.trim().min(5).max(32).required(),
  }).required()
};

export const login = {
  body: joi.object().keys({
    email: generalValidationFields.email.trim().lowercase().required(),
    password: generalValidationFields.password.required(),
  }).required()
};

export const verifyEmail = {
  body: joi.object().keys({
    email: generalValidationFields.email.trim().lowercase().required(),
  }).required()
};

export const verifyForgotPasswordCode = {
  body: verifyEmail.body.append({
    otp: generalValidationFields.otp.required()
  }).required()
};

export const resetForgotPasswordCode = {
  body: verifyForgotPasswordCode.body.append({
    password: generalValidationFields.password.required(),
    confirmPassword: generalValidationFields.confirmPassword("password").required()
  }).required()
};

export const confirmEmail = {
  body: joi.object().keys({
    email: generalValidationFields.email.required(),
    otp: generalValidationFields.otp.required()
  }).required()
};

export const reSendConfirmEmail = {
  body: joi.object().keys({
    email: generalValidationFields.email.trim().lowercase().required(),
  }).required()
};

export const updatePassword = {
  body: joi.object().keys({
    oldPassword: generalValidationFields.password.required(),
    password: generalValidationFields.password.not(joi.ref("oldPassword")).required(),
    confirmPassword: generalValidationFields.confirmPassword("password").required()
  }).required()
};
