export const users = [];

import mongoose from "mongoose";
import { GenderEnum, ProviderEnum, RoleEnum } from "../../common/enums/index.js";
const userSchema = new mongoose.Schema(
  {
    oldPassword: { type: [String], select: false },
    firstName: {
      type: String,
      required: true,
      minLength: [
        2,
        "FirstName connot be less than 2 char but you have entered a {VALUE}",
      ],
      maxLength: 25,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      minLength: [
        2,
        "lastName connot be less than 2 char but you have entered a {VALUE}",
      ],
      maxLength: 25,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      select: false,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    phone: { type: String, select: false },

    confirmEmail: Date,
    changeCredentialsTime: Date,
    // Incrementing this invalidates every JWT created with an older session.
    sessionVersion: { type: Number, default: 0, min: 0 },
    provider: {
      type: Number,
      enum: Object.values(ProviderEnum),
      default: ProviderEnum.System,
    },
    role: {
      type: Number,
      enum: Object.values(RoleEnum),
      default: RoleEnum.User,
    },
    gender: {
      type: Number,
      enum: Object.values(GenderEnum),
      default: GenderEnum.Male,
    },
    profilePicture: String,
    coverProfilePictures: [String],
  },
  {
    collection: "Route_Users",
    timestamps: true,
    strict: true,
    strictQuery: true,
    optimisticConcurrency: true,
    autoIndex: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        delete ret.oldPassword;
        delete ret.phone;
        delete ret.email;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

userSchema
  .virtual("username")
  .set(function (value) {
    const [firstName, lastName] = value?.split(" ") || [];
    this.set({ firstName, lastName });
  })
  .get(function () {
    return this.firstName + " " + this.lastName;
  });

  
export const UserModel =
  mongoose.models.Users || mongoose.model("User", userSchema);
