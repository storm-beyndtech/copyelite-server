import express from "express";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import rateLimit from "express-rate-limit";
import { User } from "../models/user.js";
import { signJwt, verifyJwt } from "../utils/jwt.js";

const router = express.Router();
const getTokenFromRequest = (req) => {
	const authHeader = req.headers.authorization || "";
	if (authHeader.startsWith("Bearer ")) return authHeader.replace("Bearer ", "").trim();
	return req.headers["x-auth-token"] || req.headers.token || req.body?.token || null;
};

// Middleware to verify JWT
const verifyToken = async (req, res, next) => {
	const token = getTokenFromRequest(req);
	if (!token) {
		return res.status(401).json({ message: "No token provided" });
	}
	try {
		const decoded = verifyJwt(token);
		const user = await User.findById(decoded.userId);
		if (!user) {
			return res.status(401).json({ message: "Unauthorized" });
		}
		req.user = user;
		next();
	} catch (error) {
		res.status(401).json({ message: "Invalid token" });
	}
};

// Rate limiting
router.use(
	"/verifyToken",
	rateLimit({
		windowMs: 5 * 60 * 1000, // 15 min
		max: 10,
		message: "Too many attempts, please try again later.",
	}),
);
router.use(
	"/verifyLogin2FA",
	rateLimit({
		windowMs: 5 * 60 * 1000,
		max: 10,
		message: "Too many 2FA attempts, please try again later.",
	}),
);

// Generate QR code
router.post("/getQrCode", verifyToken, async (req, res) => {
	try {
		const user = req.user;
		if (user.mfa) {
			return res.status(400).json({ message: "2FA already enabled" });
		}

		const secret = speakeasy.generateSecret({ name: `CopyElite: ${user.email}` });
		user.tempTwoFactorSecret = secret.base32;
		user.tempTwoFactorSecretExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
		await user.save();

		qrcode.toDataURL(secret.otpauth_url, (err, dataURL) => {
			if (err) {
				return res.status(500).json({ message: "QR code generation failed" });
			}
			res.json({ imgSrc: dataURL });
		});
	} catch (error) {
		res.status(500).json({ message: "Server error" });
	}
});

// Verify 2FA setup
router.post("/verifyToken", verifyToken, async (req, res) => {
	const { token } = req.body;
	try {
		const user = req.user;
		if (user.mfa) {
			return res.status(400).json({ message: "2FA already enabled" });
		}
		if (!user.tempTwoFactorSecret || user.tempTwoFactorSecretExpires < new Date()) {
			return res.status(400).json({ message: "2FA setup expired, please start again" });
		}

		const verified = speakeasy.totp.verify({
			secret: user.tempTwoFactorSecret,
			encoding: "base32",
			token,
			window: 1,
		});

		if (!verified) {
			return res.status(400).json({ message: "Invalid token" });
		}

		user.twoFactorSecret = user.tempTwoFactorSecret;
		user.tempTwoFactorSecret = null;
		user.tempTwoFactorSecretExpires = null;
		user.mfa = true;
		await user.save();

		const jwtToken = signJwt({ userId: user._id }, { expiresIn: "1h" });
		res.json({ message: "2FA enabled successfully", token: jwtToken });
	} catch (error) {
		res.status(500).json({ message: "Server error" });
	}
});


// Disable 2FA
router.post('/disable', verifyToken, async (req, res) => {
  const { token } = req.body;
  try {
    const user = req.user;
    if (!user.mfa) {
      return res.status(400).json({ message: '2FA is not enabled' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) {
      return res.status(400).json({ message: 'Invalid token' });
    }

    user.mfa = false;
    user.twoFactorSecret = null;
    await user.save();

    const jwtToken = signJwt({ userId: user._id }, { expiresIn: '1h' });
    res.json({ message: '2FA disabled successfully', token: jwtToken });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});


// Verify 2FA login
router.post("/verifyLogin2FA", verifyToken, async (req, res) => {
	const { token } = req.body;
	try {
		const user = req.user;
		if (!user.mfa) {
			return res.status(400).json({ message: "2FA not enabled" });
		}

		const verified = speakeasy.totp.verify({
			secret: user.twoFactorSecret,
			encoding: "base32",
			token,
			window: 1,
		});

		if (!verified) {
			return res.status(400).json({ message: "Invalid 2FA token" });
		}

		const jwtToken = signJwt({ userId: user._id }, { expiresIn: "1h" });
		res.json({ message: "2FA verified, login successful", token: jwtToken });
	} catch (error) {
		res.status(500).json({ message: "Server error" });
	}
});

export default router;
