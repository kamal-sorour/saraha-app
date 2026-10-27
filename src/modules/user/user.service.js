import { logoutEnum } from "../../common/enums/user.enum.js";
import { set, revokeTokenKey, deleteKey, keys, baseRevokTokenKey } from "../../common/services/index.js";
import { compareHash, conflictException, generateHash, notFoundException } from "../../common/utils/index.js";
import { createLoginCredentiels } from "../../common/utils/security/token.security.js";
import { findById, UserModel } from "../../DB/index.js";
import { encrypt } from "../../common/utils/security/encryption.security.js";
import { toPublicUser } from "./user.dto.js";

export const profile = async (id) => {

  const user = await findById({
    model: UserModel,
    id,

  })
  if (!user) throw notFoundException({ message: "User not found" });
  return toPublicUser(user);
};
export const logout = async ({ flag }, user, { jti, exp, sub }) => {
  let status = 200
  switch (flag) {
    case logoutEnum.All:
      user.changeCredentialsTime = new Date()
      user.sessionVersion = (user.sessionVersion ?? 0) + 1
      await user.save()
      await deleteKey(await keys(baseRevokTokenKey(sub)))
      break;

    default:
      await set({
        key: revokeTokenKey({ userId: sub, jti }),
        value: jti,
        ttl: Math.max(1, exp - Math.floor(Date.now() / 1000))
      })
      status = 201
      break;
  }
  return status
};



export const updateProfile = async (id, inputs) => {
  const update = { ...inputs };
  if (Object.hasOwn(update, "phone")) update.phone = await encrypt(update.phone);

  const user = await UserModel.findOneAndUpdate(
    { _id: id },
    { $set: update, $inc: { __v: 1 } },
    { new: true, runValidators: true, upsert: false },
  );
  return toPublicUser(user);
};

export const updateProfilePicture = async (userId, file) => {
  const user = await UserModel.findByIdAndUpdate(
    userId,
    { $set: { profilePicture: file.finalPath }, $inc: { __v: 1 } },
    { new: true, runValidators: true },
  );
  return toPublicUser(user);
};

export const updatePassword = async ({ oldPassword, password }, issuer, user) => {
  const account = await findById({ model: UserModel, id: user._id, select: "+password +oldPassword" });
  if (!account || !await compareHash({ plainText: oldPassword, cipherText: account.password })) {
    throw conflictException("Invalid old password");
  }

  // for (const hash of user.oldPassword || []) {
  // if (await compareHash({plainText:password ,cipherText:hash})) {
  //   throw conflictExpeption("Sorry this password is weak you have already used it before!!")
  // }
  // }
  account.oldPassword.push(account.password)
  account.password = await generateHash({ plainText: password })
  account.changeCredentialsTime = new Date()
  account.sessionVersion = (account.sessionVersion ?? 0) + 1
  await account.save()
  await deleteKey(await keys(baseRevokTokenKey(user._id)))
  return await createLoginCredentiels(account, issuer)
}
