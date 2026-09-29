import { findUserByToken } from "../utils/userLookup.js";

export const requireSession = async (req, res, next) => {
  try {
    const authorization = req.get("authorization") || "";
    const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const token = bearerToken || req.body?.token || req.query?.token;
    const user = await findUserByToken(token);
    if (!user) {
      return res.status(401).json({ message: "Please sign in to continue" });
    }
    req.user = user;
    return next();
  } catch (error) {
    return res.status(500).json({ message: "Unable to verify your session" });
  }
};
