const fetchWithTimeout = async (url, timeoutMs = 3000) => {
	if (typeof fetch !== "function") return null;

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await fetch(url, { signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
};

const normalizeIp = (ip) => {
	if (!ip) return "";
	const first = ip.split(",")[0].trim();
	if (first === "::1") return "127.0.0.1";
	return first.replace(/^::ffff:/, "").trim();
};

const isPrivateIp = (ip) => {
	if (!ip) return true;
	if (ip === "127.0.0.1") return true;
	if (ip.startsWith("10.")) return true;
	if (ip.startsWith("192.168.")) return true;
	if (ip.startsWith("172.")) {
		const secondOctet = Number(ip.split(".")[1]);
		return secondOctet >= 16 && secondOctet <= 31;
	}
	return false;
};

const resolveLocationFromIp = async (ipAddress) => {
	if (!ipAddress || isPrivateIp(ipAddress)) return null;

	try {
		const response = await fetchWithTimeout(`https://ipapi.co/${ipAddress}/json/`);
		if (!response?.ok) return null;

		const data = await response.json();
		return {
			city: data.city,
			region: data.region,
			country: data.country_name,
			lat: data.latitude,
			lng: data.longitude,
		};
	} catch (error) {
		console.warn("Unable to resolve location from IP:", error instanceof Error ? error.message : error);
		return null;
	}
};

export const buildRequestContext = async (req, { includeLocation = true } = {}) => {
	const forwardedFor = req.headers["x-forwarded-for"];
	const ipFromHeader = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
	const ip =
		normalizeIp(ipFromHeader) ||
		normalizeIp(req.ip) ||
		normalizeIp(req.socket?.remoteAddress) ||
		normalizeIp(req.connection?.remoteAddress);

	const baseContext = {
		ipAddress: ip,
		userAgent: req.headers["user-agent"] || "unknown",
	};

	if (!includeLocation) return baseContext;

	const location = await resolveLocationFromIp(baseContext.ipAddress);
	return { ...baseContext, location: location || undefined };
};
