import jwt from "jsonwebtoken";

const ENV_JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_PRIVATE_KEY;
const JWT_SECRET = ENV_JWT_SECRET || "your_jwt_secret";

export const getJwtSecret = () => ENV_JWT_SECRET;

export const signJwt = (payload, options = {}) => jwt.sign(payload, JWT_SECRET, options);

export const verifyJwt = (token) => jwt.verify(token, JWT_SECRET);
