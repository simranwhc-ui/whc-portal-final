
import MonthlyEvaluation from "../models/MonthlyEvaluation.js";
import Student from "../models/Student.js";

// Trainer: Create or update a monthly evaluation
export const saveMonthlyEvaluation = async (req, res) => {
  try {
    const { studentId, month, year, score, feedback } = req.body;

    if (!studentId || month === undefined || year === undefined || score === undefined) {
      return res.status(400).json({
        success: false,
        message: "Student, month, year and score are required"
      });
    }

    if (
      !Number.isInteger(Number(month)) ||
      Number(month) < 1 ||
      Number(month) > 12
    ) {
      return res.status(400).json({
        success: false,
        message: "Month must be a number between 1 and 12"
      });
    }

    if (!Number.isInteger(Number(year)) || Number(year) < 2020) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid year"
      });
    }

    if (
      !Number.isFinite(Number(score)) ||
      Number(score) < 0 ||
      Number(score) > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Score must be between 0 and 100"
      });
    }

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    if (
      !student.trainer ||
      student.trainer.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can evaluate only students assigned to you"
      });
    }

    const evaluation = await MonthlyEvaluation.findOneAndUpdate(
      {
        student: studentId,
        month: Number(month),
        year: Number(year)
      },
      {
        $set: {
          trainer: req.user._id,
          score: Number(score),
          feedback: feedback?.trim() || ""
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    ).populate("student", "name username course");

    return res.status(200).json({
      success: true,
      message: "Monthly evaluation saved successfully",
      evaluation
    });
  } catch (error) {
    console.error("Save Monthly Evaluation Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An evaluation already exists for this student and month"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to save monthly evaluation"
    });
  }
};

// Trainer: View monthly evaluations for assigned students
export const getTrainerMonthlyEvaluations = async (req, res) => {
  try {
    const evaluations = await MonthlyEvaluation.find({
      trainer: req.user._id
    })
      .populate("student", "name username course")
      .sort({ year: -1, month: -1, updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: evaluations.length,
      evaluations
    });
  } catch (error) {
    console.error("Get Trainer Monthly Evaluations Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch monthly evaluations"
    });
  }
};

// Student: View their own monthly evaluations
export const getMyMonthlyEvaluations = async (req, res) => {
  try {
    const evaluations = await MonthlyEvaluation.find({
      student: req.student._id
    })
      .populate("trainer", "name username")
      .sort({ year: -1, month: -1 });

    return res.status(200).json({
      success: true,
      count: evaluations.length,
      evaluations
    });
  } catch (error) {
    console.error("Get My Monthly Evaluations Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch monthly evaluations"
    });
  }
};
