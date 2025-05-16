import bcrypt from "bcrypt";
import express from "express";
import { User, validateUser, validateLogin } from "../models/user.js";
import { passwordReset, welcomeMail, otpMail } from "../utils/mailer.js";
import { Otp } from "../models/otp.js";

const router = express.Router();

router.get("/:id", async (req, res) => {
	try {
		let user = await User.findById(req.params.id);
		if (!user) return res.status(400).send({ message: "user not found" });
		res.send({ user });
	} catch (x) {
		return res.status(500).send({ message: "Something Went Wrong..." });
	}
});

// Getting all users sorted by creation date (newest first)
router.get("/", async (req, res) => {
	try {
		const users = await User.find().sort({ createdAt: -1 });
		res.send(users);
	} catch (error) {
		return res.status(500).send({ message: "Something Went Wrong..." });
	}
});

// reset password
router.get("/reset-password/:email", async (req, res) => {
	const { email } = req.params;
	if (!email) return res.status(400).send({ message: "Email is required" });

	try {
		const emailData = await passwordReset(email);
		if (emailData.error) return res.status(400).send({ message: emailData.error });

		res.send({ message: "Password reset link sent successfully" });
	} catch (error) {
		return res.status(500).send({ message: "Something Went Wrong..." });
	}
});

// login user
router.post("/login", async (req, res) => {
	const { email, password } = req.body;
	const { error } = validateLogin(req.body);
	if (error) return res.status(400).send({ message: error.details[0].message });

	try {
		const user = await User.findOne({ email });
		if (!user) return res.status(400).send({ message: "user not found" });

		const validatePassword = await bcrypt.compare(password, user.password);
		if (!validatePassword) return res.status(400).send({ message: "Invalid password" });

		res.send({ user });
	} catch (error) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

//sign up
router.post("/signup", async (req, res) => {
	const { username, email } = req.body;

	const { error } = validateUser(req.body);
	if (error) return res.status(400).send({ message: error.details[0].message });

	let user = await User.findOne({ $or: [{ email }, { username }] });
	if (user) return res.status(400).send({ message: "username or email already exists, please login" });

	try {
		const otp = await new Otp({ email }).save();
		const emailData = await otpMail(email, otp.code);
		if (emailData.error) return res.status(400).send({ message: emailData.error });

		res.send({ message: "success" });
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

//create a new user
router.post("/verify-otp", async (req, res) => {
	const { username, email, password, referredBy } = req.body;

	try {
		let user = await User.findOne({ email });
		console.log(req.body);

		if (!user) {
			user = new User({ username, email, password, referredBy });
			const salt = await bcrypt.genSalt(10);
			user.password = await bcrypt.hash(password, salt);

			user = await user.save();
			welcomeMail(email);
			res.send({ user });
		} else {
			const validatePassword = await bcrypt.compare(password, user.password);
			if (!validatePassword) return res.status(400).send({ message: "Invalid password" });

			res.send({ user });
		}
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

//resend - otp
router.post("/resend-otp", async (req, res) => {
	const { email } = req.body;

	try {
		const otp = await new Otp({ email }).save();
		const emailData = await otpMail(email, otp.code);
		if (emailData.error) return res.status(400).send({ message: emailData.error });

		res.send({ message: "success" });
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// new password
router.put("/new-password", async (req, res) => {
	const { email, password } = req.body;
	if (!email) return res.status(400).send({ message: "Email is required" });

	let user = await User.findOne({ email });
	if (!user) return res.status(400).send({ message: "Invalid email" });

	try {
		const salt = await bcrypt.genSalt(10);
		user.password = await bcrypt.hash(password, salt);
		user = await user.save();
		res.send({ message: "Password changed successfully" });
	} catch (error) {
		return res.status(500).send({ message: "Something Went Wrong..." });
	}
});

router.put("/update-profile", async (req, res) => {
	let user = await User.findOne({ email: req.body.email });
	if (!user) return res.status(404).send({ message: "User not found" });

	try {
		user.set(req.body);

		user = await user.save();
		res.send({ user });
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

//Delete multi users
router.delete("/", async (req, res) => {
	const { userIds, usernamePrefix, emailPrefix } = req.body;

	// Build the filter dynamically
	const filter = {};

	// Filter by IDs if provided
	if (Array.isArray(userIds) && userIds.length > 0) {
		filter._id = { $in: userIds };
	}

	// Filter by username prefix if provided
	if (usernamePrefix) {
		filter.username = { $regex: `^${usernamePrefix}`, $options: "i" }; // Case-insensitive match
	}

	// Filter by email prefix if provided
	if (emailPrefix) {
		filter.email = { $regex: `^${emailPrefix}`, $options: "i" }; // Case-insensitive match
	}

	// Check if the filter is empty
	if (Object.keys(filter).length === 0) {
		return res.status(400).json({ error: "No valid filter criteria provided" });
	}

	try {
		const result = await User.deleteMany(filter);
		res.json({ success: true, deletedCount: result.deletedCount });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Failed to delete users" });
	}
});

// PUT /api/user/
router.put("/update-user-trader", async (req, res) => {
	try {
		const { traderId, action, userId } = req.body;

		if (!userId) return res.status(401).json({ message: "Unauthorized" });

		const update = action === "copy" ? { traderId } : { $unset: { traderId: 1 } };

		const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true });

		return res.status(200).json({
			message: action === "copy" ? "Trader copied" : "Trader uncopied",
			user: updatedUser,
		});
	} catch (error) {
		console.error("Error updating traderId:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
});

export default router;
