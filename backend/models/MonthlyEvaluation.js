
import mongoose from "mongoose";

const monthlyEvaluationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true
    },
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    year: {
      type: Number,
      required: true,
      min: 2020
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    feedback: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { timestamps: true }
);

// One evaluation per student per month
monthlyEvaluationSchema.index(
  { student: 1, month: 1, year: 1 },
  { unique: true }
);

export default mongoose.model(
  "MonthlyEvaluation",
  monthlyEvaluationSchema
);
