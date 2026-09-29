import User from "../model/user.model.js";

export const findUserByToken = (token) => {
  if (typeof token !== "string" || token.length === 0) {
    return null;
  }
  return User.findOne({ token });
};