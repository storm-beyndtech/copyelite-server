import { User } from "../models/user.js";
import { buildRequestContext } from "../utils/requestContext.js";
import { getJwtSecret, verifyJwt } from "../utils/jwt.js";

const getTokenFromRequest = (req) => {
	const authHeader = req.headers.authorization || "";
	if (authHeader.startsWith("Bearer ")) return authHeader.replace("Bearer ", "").trim();

	return req.headers["x-auth-token"] || req.headers.token || req.body?.token || null;
};

export const authenticate = async (req, res, next) => {
	const token = getTokenFromRequest(req);
	if (!token) return res.status(401).json({ message: "Authentication token is missing" });

	try {
		const decoded = verifyJwt(token);
		const userId = decoded.userId || decoded._id;
		const user = await User.findById(userId);

		if (!user) return res.status(401).json({ message: "User not found for token" });

		req.user = user;
		req.authPayload = decoded;
		req.requestContext = await buildRequestContext(req, { includeLocation: false });
		next();
	} catch (error) {
		console.error("Authentication error:", error);
		return res.status(401).json({ message: "Invalid or expired token" });
	}
};

export const requireAdmin = (req, res, next) => {
	if (!req.user?.isAdmin) return res.status(403).json({ message: "Admin permissions required" });
	next();
};
