import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { ActivityLog } from "../models/activityLog.js";

const router = express.Router();

router.get("/", authenticate, requireAdmin, async (req, res) => {
	const { limit = 50, action } = req.query;
	const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

	const filters = {};
	if (action) filters.action = action;

	try {
		const logs = await ActivityLog.find(filters).sort({ createdAt: -1 }).limit(parsedLimit).lean();
		res.json({ logs });
	} catch (error) {
		console.error("Failed to fetch activity logs:", error);
		res.status(500).json({ message: "Unable to fetch activity logs" });
	}
});

export default router;
