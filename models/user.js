import Joi from "joi";
import mongoose from "mongoose";
import { signJwt } from "../utils/jwt.js";

export const userSchema = new mongoose.Schema({
	title: { type: String, maxLength: 10 },
	firstName: { type: String, maxLength: 30 },
	lastName: { type: String, maxLength: 30 },
	fullName: {
		type: String,
		maxLength: 60,
		default: "",
	},
	username: {
		type: String,
		required: true,
		minLength: 3,
		maxLength: 20,
	},
	email: {
		type: String,
		required: true,
		minLength: 5,
		maxLength: 225,
	},
	phone: {
		type: String,
		maxLength: 15,
		default: "",
	},
	dob: { type: String, default: "" },
	houseNo: { type: String, maxLength: 20, default: "" },
	streetAddress: { type: String, maxLength: 100, default: "" },
	city: {
		type: String,
		maxLength: 50,
		default: "",
	},
	province: {
		type: String,
		maxLength: 50,
		default: "",
	},
	zipCode: {
		type: String,
		maxLength: 50,
		default: "",
	},
	taxResidency: { type: String, maxLength: 50 },
	country: {
		type: String,
		maxLength: 50,
		default: "United States", // optional default
	},
	annualIncome: { type: String },
	incomeSource: { type: String },
	instruments: { type: String },
	preferredMarkets: { type: String },
	knowledgeLevel: { type: String },
	tradingFrequency: { type: String },
	tradingPlatforms: { type: String },
	yearsTrading: { type: String },

	documentFront: { type: String },
	documentBack: { type: String },
	documentNumber: { type: String },
	documentExpDate: { type: String },

	password: {
		type: String,
	},
	deposit: {
		type: Number,
		default: 0,
		minLength: 0,
	},
	demo: {
		type: Number,
		default: 0,
		minLength: 0,
	},
	interest: {
		type: Number,
		default: 0,
		minLength: 0,
	},
	withdraw: {
		type: Number,
		default: 0,
		minLength: 0,
	},
	bonus: {
		type: Number,
		default: 0,
		minLength: 0,
	},
	referredBy: {
		type: String,
		default: "",
		maxLength: 50,
	},
	profileImage: {
		type: String,
		default: "",
		maxLength: 500,
	},
	isAdmin: {
		type: Boolean,
		default: false,
		immutable: true,
	},
	mfa: {
		type: Boolean,
		default: false,
	},
	idVerified: {
		type: Boolean,
		default: false,
	},
	isGoogleUser: {
		type: Boolean,
		default: false,
	},
	withdrawalLimit: {
		type: Number,
		default: 100000,
	},
	minWithdrawal: {
		type: Number,
		default: 10,
	},
	withdrawalStatus: {
		type: Boolean,
		default: true,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	rank: {
		type: String,
		default: "welcome",
	},
	traderId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Trader",
		default: null,
	},
	twoFactorSecret: { type: String, default: null },
	tempTwoFactorSecret: { type: String, default: null },
	tempTwoFactorSecretExpires: { type: Date, default: null },
});

userSchema.methods.genAuthToken = function () {
	return signJwt({ _id: this._id, username: this.username, isAdmin: this.isAdmin });
};

userSchema.pre("save", function (next) {
	const names = [];
	if (this.firstName) names.push(this.firstName);
	if (this.lastName) names.push(this.lastName);
	this.fullName = names.join(" ");
	next();
});

export const User = mongoose.model("User", userSchema);

const scrubPrivilegedUpdate = (update) => {
	if (!update) return;
	if (update.isAdmin !== undefined) delete update.isAdmin;
	if (update.$set?.isAdmin !== undefined) delete update.$set.isAdmin;
	if (update.$setOnInsert?.isAdmin !== undefined) delete update.$setOnInsert.isAdmin;
};

userSchema.pre("save", function (next) {
	if (!this.isNew && this.isModified("isAdmin")) {
		this.invalidate("isAdmin", "isAdmin field is immutable once set");
		return next(new Error("isAdmin field is immutable"));
	}
	next();
});

userSchema.pre(["findOneAndUpdate", "updateOne", "updateMany", "update"], function (next) {
	const update = this.getUpdate();
	scrubPrivilegedUpdate(update);
	next();
});

export const validateUser = (user) => {
	const schema = {
		username: Joi.string().min(3).max(20).required(),
		email: Joi.string().min(5).max(225).required(),
		password: Joi.string().min(5).max(20),
		referredBy: Joi.string().min(0).max(50).allow(""),
	};

	return Joi.validate(user, schema);
};

export const validateLogin = (user) => {
	const schema = {
		email: Joi.string().min(5).max(225).email().allow(""),
		username: Joi.string().min(3).max(20).allow(""),
		password: Joi.string().min(5).max(20).required(),
	};

	return Joi.validate(user, schema);
};
