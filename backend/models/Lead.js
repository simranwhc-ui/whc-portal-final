import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
    {
        studentName: {
            type: String,
            required: true,
            trim: true
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        course: {
            type: String,
            required: true,
            trim: true
        },

        assignedCounsellor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        status: {
            type: String,
            enum: [
                "pending",
                "contacted",
                "follow_up",
                "converted",
                "lost"
            ],
            default: "pending"
        },

        followUpCounts: {
            call: {
                type: Number,
                default: 0,
                min: 0
            },
            whatsapp: {
                type: Number,
                default: 0,
                min: 0
            }
        },

        followUpHistory: [{
            channel: {
                type: String,
                enum: ["call", "whatsapp"],
                required: true
            },
            followedUpAt: {
                type: Date,
                default: Date.now
            }
        }],

        convertedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model("Lead", leadSchema);