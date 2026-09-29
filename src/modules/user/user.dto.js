export const toPublicUser = (user) => {
  if (!user) return null;

  const value = typeof user.toObject === "function" ? user.toObject() : user;

  return {
    id: String(value._id ?? value.id),
    username: value.username ?? [value.firstName, value.lastName].filter(Boolean).join(" "),
    firstName: value.firstName,
    lastName: value.lastName,
    gender: value.gender,
    profilePicture: value.profilePicture,
    coverProfilePictures: value.coverProfilePictures ?? [],
    createdAt: value.createdAt,
  };
};