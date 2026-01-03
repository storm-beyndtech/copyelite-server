import express from "express";
import { Transaction } from "../models/transaction.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

// get all transactions by user
router.get("/user/:email", authenticate, async (req, res) => {
	const { email } = req.params;

	try {
		let transactions = await Transaction.find({ "user.email": email });
		if (!transactions || transactions.length === 0) return res.status(400).send({ message: "Transactions not found..." });

		transactions = transactions.flat();
		transactions.sort((a, b) => b.date - a.date);

		const isSelf = req.user?.email === email;
		if (!isSelf && !req.user?.isAdmin) return res.status(403).send({ message: "Unauthorized" });

		res.send(transactions);
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// getting single transaction
router.get("/:id", authenticate, async (req, res) => {
	const { id } = req.params;

	try {
		const transaction = await Transaction.findById(id);

		if (!transaction) return res.status(400).send({ message: "Transaction not found..." });
		const isOwner = req.user?.email && transaction?.user?.email === req.user.email;
		if (!isOwner && !req.user?.isAdmin) return res.status(403).send({ message: "Unauthorized" });
		res.send(transaction);
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// getting all transactions
router.get("/", authenticate, requireAdmin, async (req, res) => {
	try {
		let transactions = await Transaction.find();
		if (!transactions || transactions.length === 0) return res.status(400).send({ message: "Transactions not found..." });

		transactions = transactions.flat();
		transactions.sort((a, b) => b.date - a.date);

		res.send(transactions);
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// Update a single transaction by ID
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
	const { id } = req.params;
	const { amount, convertedAmount } = req.body;

	try {
		if (!amount || !convertedAmount) {
			return res.status(400).send({ message: "Both amount and convertedAmount are required." });
		}

		// Find the transaction by ID and update the fields
		const updatedTransaction = await Transaction.findByIdAndUpdate(
			id,
			{
				$set: {
					amount,
					"walletData.convertedAmount": convertedAmount,
				},
			},
			{ new: true },
		);

		// Check if the transaction was found and updated
		if (!updatedTransaction) return res.status(404).send({ message: "Transaction not found." });

		await logActivity(req, {
			actor: req.user,
			action: "transaction_update",
			target: { type: "Transaction", id },
			metadata: { amount, convertedAmount },
			notifyAdmin: false,
		});

		res.send({ message: "Transaction updated successfully." });
	} catch (error) {
		res.status(500).send({ message: "Something went wrong while updating the transaction." });
	}
});

// Delete a transaction
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
	const { id } = req.params;

	try {
		const transaction = await Transaction.findByIdAndRemove(id);

		if (!transaction) return res.status(400).send({ message: "Transaction not found..." });
		await logActivity(req, {
			actor: req.user,
			action: "transaction_delete",
			target: { type: "Transaction", id },
			metadata: { amount: transaction.amount, type: transaction.type },
			notifyAdmin: false,
		});
		res.send(transaction);
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

export default router;
