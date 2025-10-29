import mongoose, { Schema, type Document, type Model } from "mongoose";

export type ItemRequirement = {
	itemId: string;
	quantity: number;
	notes?: string;
};

export interface ItemDocument extends Document {
	itemId: string;
	name: string;
	description: string;
	imageUrl: string;
	requirements: ItemRequirement[];
	tags: string[];
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
}

const RequirementSchema = new Schema<ItemRequirement>(
	{
		itemId: { type: String, required: true, trim: true },
		quantity: { type: Number, required: true, min: 1, default: 1 },
		notes: { type: String, trim: true },
	},
	{ _id: false },
);

const ItemSchema = new Schema<ItemDocument>(
	{
		itemId: { type: String, required: true, unique: true, index: true, trim: true },
		name: { type: String, required: true, trim: true },
		description: { type: String, required: true, trim: true },
		imageUrl: { type: String, required: true, trim: true },
		requirements: { type: [RequirementSchema], default: [] },
		tags: { type: [String], default: [] },
		metadata: { type: Schema.Types.Map, of: Schema.Types.Mixed, default: {} },
	},
	{
		timestamps: true,
		collection: "items",
	},
);

export const ItemModel: Model<ItemDocument> = mongoose.models.Item || mongoose.model<ItemDocument>("Item", ItemSchema);

