import mongoose from "mongoose";

const feeSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        paidAmount: {
            type: Number,
            default: 0,
            min: 0
        },

        dueDate: {
            type: Date,
            required: true
        },

        paidDate: {
            type: Date,
            default: null
        },

        paymentHistory: [{
            amount: {
                type: Number,
                required: true,
                min: 0
            },
            paidAt: {
                type: Date,
                default: Date.now
            }
        }],

        status: {
            type: String,
            enum: [
                "upcoming",
                "paid",
                "overdue"
            ],
            default: "upcoming"
        },

        description: {
            type: String,
            trim: true,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model("Fee", feeSchema);