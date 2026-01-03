import { ActivityLog } from "../models/activityLog.js";
import { adminActivityMail } from "./mailer.js";
import { buildRequestContext } from "./requestContext.js";

const parseDeviceFromUserAgent = (userAgent) => {
	if (!userAgent) return "unknown";
	const lowered = userAgent.toLowerCase();

	if (lowered.includes("mobile")) return "mobile";
	if (lowered.includes("android")) return "android";
	if (lowered.includes("iphone") || lowered.includes("ipad")) return "ios";
	if (lowered.includes("windows")) return "windows";
	if (lowered.includes("mac os")) return "mac";
	if (lowered.includes("linux")) return "linux";
	return "unknown";
};

export const logActivity = async (req, { actor, action, target = {}, metadata = {}, notifyAdmin = false }) => {
	const existingContext = req.requestContext;
	const baseContext = existingContext || (await buildRequestContext(req, { includeLocation: false }));
	const contextWithLocation =
		baseContext?.location !== undefined
			? baseContext
			: await buildRequestContext(
					{
						...req,
						ip: baseContext?.ipAddress,
						headers: { ...req.headers, "x-forwarded-for": baseContext?.ipAddress || req.headers["x-forwarded-for"] },
					},
					{ includeLocation: true },
			  );

	const context = contextWithLocation || baseContext;
	const location = context?.location;

	const payload = {
		actorId: actor?._id,
		actorEmail: actor?.email,
		actorRole: actor?.isAdmin ? "admin" : "user",
		action,
		targetCollection: target.type,
		targetId: target.id,
		metadata,
		ipAddress: context?.ipAddress,
		userAgent: context?.userAgent,
		location: location || undefined,
	};

	try {
		const entry = await ActivityLog.create(payload);

		if (notifyAdmin) {
			await adminActivityMail({
				action,
				actor,
				target,
				ipAddress: context.ipAddress,
				location,
				userAgent: context.userAgent,
				device: parseDeviceFromUserAgent(context.userAgent),
				metadata,
			});
		}

		return entry;
	} catch (error) {
		console.error("Activity log error:", error);
		return null;
	}
};
