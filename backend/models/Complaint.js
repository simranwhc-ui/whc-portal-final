import mongoose from "mongoose";

const complaintRecipientSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        role: {
            type: String,
            enum: ["admin", "counsellor", "trainer"],
            required: true
        },
        response: {
            type: String,
            trim: true,
            default: ""
        },
        resolvedAt: {
            type: Date,
            default: null
        }
    },
    { _id: false }
);

const complaintSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true,
            index: true
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 3000
        },
        recipients: {
            type: [complaintRecipientSchema],
            validate: {
                validator: (recipients) => recipients.length > 0,
                message: "At least one complaint recipient is required"
            }
        },
        resolvedAt: {
            type: Date,
            default: null
        },
        deleteAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

complaintSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Complaint", complaintSchema);
