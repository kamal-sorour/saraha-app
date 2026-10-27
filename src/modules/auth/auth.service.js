import {
  compareHash,
  conflictException,
  encrypt,
  notFoundException,
  generateHash,
} from "../../common/utils/index.js";
import { createOne, findOne } from "../../DB/index.js";
import { UserModel } from "../../DB/models/index.js";
import { createLoginCredentiels } from "../../common/utils/security/token.security.js";
import { ProviderEnum } from "../../common/enums/user.enum.js";
import { EmailEnum } from "../../common/enums/index.js";
import { issueOtp, verifyOtp } from "./otp.service.js";
import { verifyGoogleIdToken } from "./google.service.js";

const defaultDependencies = {
  compareHash, conflictException, createLoginCredentiels, createOne, encrypt,
  findOne, generateHash, issueOtp, notFoundException, UserModel, verifyOtp, verifyGoogleIdToken,
};

// Injectable dependencies keep account-security flows deterministic in tests.
export const createAuthService = (overrides = {}) => {
  const deps = { ...defaultDependencies, ...overrides };

  const Signup = async ({ username, email, password, phone }) => {
    const exists = await deps.findOne({ model: deps.UserModel, filter: { email } });
    if (exists) throw deps.conflictException("Email alredy is Exist");
    const user = await deps.createOne({
      model: deps.UserModel,
      data: {
        username, email,
        password: await deps.generateHash({ plainText: password }),
        phone: await deps.encrypt(phone),
      },
    });
    await deps.issueOtp({ email, type: EmailEnum.ConfirmEmail, title: "Verify Account" });
    return user;
  };

  const confirmEmail = async ({ email, otp }) => {
    const account = await deps.findOne({
      model: deps.UserModel,
      filter: { email, confirmEmail: { $exists: false }, provider: ProviderEnum.System },
    });
    if (!account) throw deps.notFoundException({ message: "fail to matching account" });
    await deps.verifyOtp({ email, otp, type: EmailEnum.ConfirmEmail, consume: true });
    account.confirmEmail = new Date();
    await account.save();
  };

  const resendConfirmEmail = async ({ email }) => {
    const account = await deps.findOne({
      model: deps.UserModel,
      filter: { email, confirmEmail: { $exists: false }, provider: ProviderEnum.System },
    });
    if (!account) throw deps.notFoundException({ message: "fail to matching account" });
    await deps.issueOtp({ email, type: EmailEnum.ConfirmEmail, title: "Verify Account" });
  };

  const login = async ({ email, password }) => {
    const user = await deps.findOne({
      model: deps.UserModel,
      // Do not reveal whether an account exists or merely awaits confirmation.
      filter: { email, confirmEmail: { $exists: true }, provider: ProviderEnum.System },
      select: "+password",
      options: { lean: true },
    });
    if (!user || !await deps.compareHash({ plainText: password, cipherText: user.password })) {
      throw deps.notFoundException({ message: "invalid login" });
    }
    return deps.createLoginCredentiels(user, "Saraha_App");
  };

  const googleLogin = async ({ credential }) => {
    const identity = await deps.verifyGoogleIdToken(credential);
    const linkedAccount = await deps.findOne({ model: deps.UserModel, filter: { googleId: identity.googleId } });
    if (linkedAccount) {
      return { account: linkedAccount, credentials: await deps.createLoginCredentiels(linkedAccount) };
    }

    // Never link a password account merely because Google reports the same email.
    const accountWithEmail = await deps.findOne({ model: deps.UserModel, filter: { email: identity.email } });
    if (accountWithEmail) {
      throw deps.conflictException({ message: "An account with this email already exists. Sign in with its original method." });
    }

    const account = await deps.createOne({
      model: deps.UserModel,
      data: {
        username: `${identity.firstName} ${identity.lastName}`,
        email: identity.email,
        googleId: identity.googleId,
        provider: ProviderEnum.Google,
        confirmEmail: new Date(),
        ...(identity.picture ? { profilePicture: identity.picture } : {}),
      },
    });
    return { account, credentials: await deps.createLoginCredentiels(account) };
  };

  const requestForgotPasswordCode = async ({ email }) => {
    const account = await deps.findOne({
      model: deps.UserModel,
      filter: { email, confirmEmail: { $exists: true }, provider: ProviderEnum.System },
    });
    if (!account) throw deps.notFoundException({ message: "invalid account" });
    await deps.issueOtp({ email, type: EmailEnum.ForgotPassword, title: "Reset Password" });
  };

  const verifyForgotPasswordCode = ({ email, otp }) => (
    deps.verifyOtp({ email, otp, type: EmailEnum.ForgotPassword })
  );

  const resetForgotPasswordCode = async ({ email, otp, password }) => {
    const account = await deps.findOne({
      model: deps.UserModel,
      filter: { email, confirmEmail: { $exists: true }, provider: ProviderEnum.System },
      select: "+password +oldPassword",
    });
    if (!account) throw deps.notFoundException({ message: "invalid account" });
    await deps.verifyOtp({ email, otp, type: EmailEnum.ForgotPassword, consume: true });
    account.password = await deps.generateHash({ plainText: password });
    account.changeCredentialsTime = new Date();
    account.sessionVersion = (account.sessionVersion ?? 0) + 1;
    await account.save();
  };

  return { Signup, confirmEmail, resendConfirmEmail, login, googleLogin, requestForgotPasswordCode, verifyForgotPasswordCode, resetForgotPasswordCode };
};

const authService = createAuthService();

export const {
  Signup, confirmEmail, resendConfirmEmail, login, googleLogin, requestForgotPasswordCode,
  verifyForgotPasswordCode, resetForgotPasswordCode,
} = authService;
