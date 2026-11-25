import Fee from "../models/Fee.js";
import Student from "../models/Student.js";


// Create a fee installment
export const createFee = async (req, res) => {
    try {
        const {
            student,
            amount,
            dueDate,
            description
        } = req.body;

        if (!student || amount === undefined || !dueDate) {
            return res.status(400).json({
                success: false,
                message:
                    "Student, amount and due date are required"
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Amount must be greater than 0"
            });
        }

        const studentExists = await Student.findById(student);

        if (!studentExists) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        // Dropped students should not receive new fee records
        if (studentExists.status === "drop") {
            return res.status(400).json({
                success: false,
                message:
                    "Fees cannot be created for a dropped student"
            });
        }

        const fee = await Fee.create({
            student,
            amount,
            dueDate,
            description,
            paidAmount: 0,
            status: "upcoming"
        });

        const populatedFee = await Fee.findById(fee._id)
            .populate(
                "student",
                "name phone course plan status"
            );

        res.status(201).json({
            success: true,
            message: "Fee installment created successfully",
            fee: populatedFee
        });

    } catch (error) {
        console.error("Create fee error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

//Get all fee

export const getFees = async (req, res) => {
    try {
        const { status } = req.query;

        const allowedStatuses = [
            "paid",
            "overdue",
            "upcoming"
        ];

        if (
            status &&
            status !== "all" &&
            !allowedStatuses.includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Status must be all, paid, overdue or upcoming"
            });
        }

        const students = await Student.find({
            status: { $ne: "drop" }
        }).select("_id");

        const studentIds = students.map(
            student => student._id
        );

        const query = {
            student: { $in: studentIds }
        };

        if (status && status !== "all") {
            query.status = status;
        }

        const fees = await Fee.find(query)
            .populate(
                "student",
                "name phone course plan status"
            )
            .sort({ dueDate: 1 });

        res.status(200).json({
            success: true,
            count: fees.length,
            filter: status || "all",
            fees
        });

    } catch (error) {
        console.error("Get fees error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Get fee of one Student

export const getStudentFees = async (req, res) => {
    try {
        const student = await Student.findById(req.params.studentId);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        const fees = await Fee.find({
            student: student._id
        }).sort({ dueDate: 1 });

        res.status(200).json({
            success: true,
            student: {
                id: student._id,
                name: student.name,
                phone: student.phone,
                course: student.course,
                status: student.status
            },
            count: fees.length,
            fees
        });

    } catch (error) {
        console.error("Get student fees error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Receive the amount paid and calculate the status.

export const recordPayment = async (req, res) => {
    try {
        const { paidAmount } = req.body;

        if (paidAmount === undefined || paidAmount <= 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Paid amount must be greater than 0"
            });
        }

        const fee = await Fee.findById(req.params.id);

        if (!fee) {
            return res.status(404).json({
                success: false,
                message: "Fee record not found"
            });
        }

        const remainingAmount =
            fee.amount - fee.paidAmount;

        if (paidAmount > remainingAmount) {
            return res.status(400).json({
                success: false,
                message:
                    "Payment cannot be greater than remaining amount"
            });
        }

        const paidAt = new Date();
        fee.paidAmount += paidAmount;
        fee.paymentHistory.push({ amount: paidAmount, paidAt });

        if (fee.paidAmount >= fee.amount) {
            fee.paidAmount = fee.amount;
            fee.status = "paid";
            fee.paidDate = paidAt;
        } else {
            // Partially paid
            const today = new Date();
            const dueDate = new Date(fee.dueDate);

            if (dueDate < today) {
                fee.status = "overdue";
            } else {
                fee.status = "upcoming";
            }
        }

        await fee.save();

        const updatedFee = await Fee.findById(fee._id)
            .populate(
                "student",
                "name phone course plan status"
            );

        res.status(200).json({
            success: true,
            message: "Payment recorded successfully",
            fee: updatedFee
        });

    } catch (error) {
        console.error("Record payment error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

//Fee Dashboard

export const getFeeDashboard = async (req, res) => {
    try {
        const today = new Date();

        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(
            sevenDaysLater.getDate() + 7
        );

        // Ignore dropped students
        const activeStudents = await Student.find({
            status: { $ne: "drop" }
        }).select("_id");

        const activeStudentIds = activeStudents.map(
            student => student._id
        );

        const fees = await Fee.find({
            student: { $in: activeStudentIds }
        });

        let totalExpected = 0;
        let totalPaid = 0;
        let totalOverdue = 0;
        let totalUpcoming = 0;

        const paidStudents = new Set();
        const overdueStudents = new Set();
        const upcomingStudents = new Set();

        for (const fee of fees) {

            totalExpected += fee.amount;

            totalPaid += fee.paidAmount;

            const remaining =
                fee.amount - fee.paidAmount;

            if (fee.paidAmount >= fee.amount) {

                paidStudents.add(
                    fee.student.toString()
                );

            } else if (
                new Date(fee.dueDate) < today
            ) {

                totalOverdue += remaining;

                overdueStudents.add(
                    fee.student.toString()
                );

            } else if (
                new Date(fee.dueDate) >= today &&
                new Date(fee.dueDate) <= sevenDaysLater
            ) {

                totalUpcoming += remaining;

                upcomingStudents.add(
                    fee.student.toString()
                );
            }
        }

        res.status(200).json({
            success: true,

            dashboard: {
                totalExpected,
                totalPaid,

                paidStudents:
                    paidStudents.size,

                totalOverdue,

                overdueStudents:
                    overdueStudents.size,

                totalUpcoming,

                upcomingStudents:
                    upcomingStudents.size
            }
        });

    } catch (error) {
        console.error(
            "Get fee dashboard error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

//Update fees
export const updateFee = async (req, res) => {
    try {
        const fee = await Fee.findById(req.params.id);

        if (!fee) {
            return res.status(404).json({
                success: false,
                message: "Fee record not found"
            });
        }

        const {
            amount,
            dueDate,
            description
        } = req.body;

        if (amount !== undefined) {
            if (amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Amount must be greater than 0"
                });
            }

            if (amount < fee.paidAmount) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Amount cannot be less than amount already paid"
                });
            }

            fee.amount = amount;
        }

        if (dueDate) {
            fee.dueDate = dueDate;
        }

        if (description !== undefined) {
            fee.description = description;
        }

        // Recalculate status
        if (fee.paidAmount >= fee.amount) {
            fee.paidAmount = fee.amount;
            fee.status = "paid";

            if (!fee.paidDate) {
                fee.paidDate = new Date();
            }
        } else {
            const today = new Date();
            const due = new Date(fee.dueDate);

            if (due < today) {
                fee.status = "overdue";
            } else {
                fee.status = "upcoming";
            }

            fee.paidDate = null;
        }

        await fee.save();

        const updatedFee = await Fee.findById(fee._id)
            .populate(
                "student",
                "name phone course plan status"
            );

        res.status(200).json({
            success: true,
            message: "Fee updated successfully",
            fee: updatedFee
        });

    } catch (error) {
        console.error("Update fee error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Delete fees

export const deleteFee = async (req, res) => {
    try {
        const fee = await Fee.findById(req.params.id);

        if (!fee) {
            return res.status(404).json({
                success: false,
                message: "Fee record not found"
            });
        }

        await fee.deleteOne();

        res.status(200).json({
            success: true,
            message: "Fee record deleted successfully"
        });

    } catch (error) {
        console.error("Delete fee error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};