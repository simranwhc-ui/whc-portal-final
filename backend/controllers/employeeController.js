import User from "../models/User.js";
import bcrypt from "bcryptjs";
import Lead from "../models/Lead.js";


// ==========================================
// REUSABLE CREATE EMPLOYEE FUNCTION
// ==========================================

const createEmployee = async (req, res, role) => {
    try {
        const {
            name,
            email,
            phone,
            username,
            password,
            specialty
        } = req.body;

        // Required fields
        if (!name || !email || !phone || !username || !password) {
            return res.status(400).json({
                success: false,
                message:
                    "Name, email, phone, username and password are required"
            });
        }

        if (typeof phone !== "string" || phone.trim().length < 6) {
            return res.status(400).json({
                success: false,
                message: "Phone number must be at least 6 characters"
            });
        }

        // Check username
        const existingUsername = await User.findOne({
            username: username.toLowerCase()
        });

        if (existingUsername) {
            return res.status(409).json({
                success: false,
                message: "Username already exists"
            });
        }

        // Check email
        const existingEmail = await User.findOne({
            email: email.toLowerCase()
        });

        if (existingEmail) {
            return res.status(409).json({
                success: false,
                message: "Email already exists"
            });
        }

        // Check phone
        const existingPhone = await User.findOne({
            phone
        });

        if (existingPhone) {
            return res.status(409).json({
                success: false,
                message: "Phone number already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create employee
        const employee = await User.create({
            name,
            email: email.toLowerCase(),
            phone,
            username: username.toLowerCase(),
            password: hashedPassword,
            role,
            status: "active",
            employmentStatus: "active",
            subjects: role === "trainer" && specialty
                ? [specialty.trim()]
                : []
        });

        res.status(201).json({
            success: true,
            message: `${role} created successfully`,

            employee: {
                id: employee._id,
                name: employee.name,
                email: employee.email,
                phone: employee.phone,
                username: employee.username,
                role: employee.role,
                status: employee.status,
                employmentStatus: employee.employmentStatus,
                subjects: employee.subjects
            }
        });

    } catch (error) {
        console.error("Create employee error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// ==========================================
// CREATE COUNSELLOR
// ==========================================

export const createCounsellor = async (req, res) => {
    return createEmployee(req, res, "counsellor");
};


// ==========================================
// CREATE TRAINER
// ==========================================

export const createTrainer = async (req, res) => {
    return createEmployee(req, res, "trainer");
};


// ==========================================
// GET ALL COUNSELLORS
// ==========================================

export const getCounsellors = async (req, res) => {
    try {

        const counsellors = await User.find({
            role: "counsellor"
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: counsellors.length,
            counsellors
        });

    } catch (error) {
        console.error("Get counsellors error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// ==========================================
// GET ALL TRAINERS
// ==========================================

export const getTrainers = async (req, res) => {
    try {

        const trainers = await User.find({
            role: "trainer"
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: trainers.length,
            trainers
        });

    } catch (error) {
        console.error("Get trainers error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// ==========================================
// GET ONE EMPLOYEE
// ==========================================

export const getEmployeeById = async (req, res) => {
    try {

        const employee = await User.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        if (!["counsellor", "trainer"].includes(employee.role)) {
            return res.status(400).json({
                success: false,
                message: "User is not a counsellor or trainer"
            });
        }

        res.status(200).json({
            success: true,
            employee
        });

    } catch (error) {
        console.error("Get employee error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// ==========================================
// UPDATE EMPLOYEE
// ==========================================

export const updateEmployee = async (req, res) => {
    try {

        const employee = await User.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        if (!["counsellor", "trainer"].includes(employee.role)) {
            return res.status(400).json({
                success: false,
                message: "User is not a counsellor or trainer"
            });
        }

        const { name, email, phone, username, password, specialty } = req.body;

        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Name cannot be empty"
                });
            }
            employee.name = name.trim();
        }

        if (email !== undefined) {
            if (typeof email !== "string" || !email.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Email cannot be empty"
                });
            }
            employee.email = email.trim().toLowerCase();
        }

        if (phone !== undefined) {
            if (typeof phone !== "string" || phone.trim().length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number must be at least 6 characters"
                });
            }
            employee.phone = phone.trim();
        }

        if (username !== undefined) {
            if (typeof username !== "string" || !username.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Username cannot be empty"
                });
            }
            employee.username = username.trim().toLowerCase();
        }

        if (password !== undefined && password !== "") {
            if (typeof password !== "string" || password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "Password must be at least 6 characters"
                });
            }
            employee.password = await bcrypt.hash(password, 10);
        }

        if (employee.role === "trainer" && specialty !== undefined) {
            if (typeof specialty !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Specialty must be text"
                });
            }
            employee.subjects = [...new Set(
                specialty.split(",").map(subject => subject.trim()).filter(Boolean)
            )];
        }

        await employee.save();

        res.status(200).json({
            success: true,
            message: "Employee updated successfully",
            employee: {
                id: employee._id,
                name: employee.name,
                email: employee.email,
                phone: employee.phone,
                username: employee.username,
                role: employee.role,
                status: employee.status,
                employmentStatus: employee.employmentStatus,
                subjects: employee.subjects
            }
        });

    } catch (error) {

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email, phone or username already exists"
            });
        }

        console.error("Update employee error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// ==========================================
// ACTIVATE / DEACTIVATE LOGIN
// ==========================================

export const changeEmployeeStatus = async (req, res) => {
    try {

        const { status } = req.body;

        if (!["active", "inactive"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be active or inactive"
            });
        }

        const employee = await User.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        if (!["counsellor", "trainer"].includes(employee.role)) {
            return res.status(400).json({
                success: false,
                message: "User is not a counsellor or trainer"
            });
        }

        employee.status = status;

        await employee.save();

        res.status(200).json({
            success: true,
            message: `Employee marked as ${status}`,
            employee
        });

    } catch (error) {
        console.error("Change employee status error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// ==========================================
// COUNSELLOR LEAVE STATUS
// ==========================================

export const changeCounsellorLeaveStatus = async (req, res) => {
    try {

        const { employmentStatus } = req.body;

        if (!["active", "on_leave"].includes(employmentStatus)) {
            return res.status(400).json({
                success: false,
                message:
                    "Employment status must be active or on_leave"
            });
        }

        const counsellor = await User.findById(req.params.id);

        if (!counsellor) {
            return res.status(404).json({
                success: false,
                message: "Counsellor not found"
            });
        }

        if (counsellor.role !== "counsellor") {
            return res.status(400).json({
                success: false,
                message: "Selected user is not a counsellor"
            });
        }

        counsellor.employmentStatus = employmentStatus;

        await counsellor.save();

        res.status(200).json({
            success: true,
            message:
                employmentStatus === "on_leave"
                    ? "Counsellor marked on leave"
                    : "Counsellor marked active",
            counsellor
        });

    } catch (error) {
        console.error("Counsellor leave error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// ==========================================
// DELETE EMPLOYEE
// ==========================================


export const deleteEmployee = async (req, res) => {
    try {
        const employee = await User.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Only counsellors and trainers can be deleted
        if (!["counsellor", "trainer"].includes(employee.role)) {
            return res.status(400).json({
                success: false,
                message:
                    "Only counsellors and trainers can be deleted"
            });
        }

        // Counsellor-specific check
        // A counsellor cannot be deleted while they
        // still have non-converted leads.
        if (employee.role === "counsellor") {
            const activeLeads = await Lead.countDocuments({
                assignedCounsellor: employee._id,
                status: { $ne: "converted" }
            });

            if (activeLeads > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Counsellor has ${activeLeads} active leads. Transfer the leads before deleting the counsellor.`
                });
            }
        }

        // Delete employee
        await employee.deleteOne();

        res.status(200).json({
            success: true,
            message: `${employee.role} deleted successfully`
        });

    } catch (error) {
        console.error("Delete employee error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};




export const transferCounsellorWork = async (req, res) => {
    try {
        const { fromCounsellorId, toCounsellorId } = req.body;

        if (!fromCounsellorId || !toCounsellorId) {
            return res.status(400).json({
                success: false,
                message: "Both source and destination counsellor are required"
            });
        }

        if (fromCounsellorId === toCounsellorId) {
            return res.status(400).json({
                success: false,
                message: "Source and destination counsellor cannot be the same"
            });
        }

        // Find source counsellor
        const sourceCounsellor = await User.findOne({
            _id: fromCounsellorId,
            role: "counsellor"
        });

        if (!sourceCounsellor) {
            return res.status(404).json({
                success: false,
                message: "Source counsellor not found"
            });
        }

        // Source counsellor MUST be on leave
        if (sourceCounsellor.employmentStatus !== "on_leave") {
            return res.status(400).json({
                success: false,
                message: "Counsellor must be on leave before work can be transferred"
            });
        }

        // Find destination counsellor
        const destinationCounsellor = await User.findOne({
            _id: toCounsellorId,
            role: "counsellor"
        });

        if (!destinationCounsellor) {
            return res.status(404).json({
                success: false,
                message: "Destination counsellor not found"
            });
        }

        // Destination must be active
        if (destinationCounsellor.status !== "active") {
            return res.status(400).json({
                success: false,
                message: "Destination counsellor is inactive"
            });
        }

        // Destination cannot be on leave
        if (destinationCounsellor.employmentStatus === "on_leave") {
            return res.status(400).json({
                success: false,
                message: "Destination counsellor is currently on leave"
            });
        }

        // Transfer only non-converted leads
        const result = await Lead.updateMany(
            {
                assignedCounsellor: fromCounsellorId,
                status: { $ne: "converted" }
            },
            {
                $set: {
                    assignedCounsellor: toCounsellorId
                }
            }
        );

        res.status(200).json({
            success: true,
            message: "Counsellor work transferred successfully",
            transferredLeads: result.modifiedCount
        });

    } catch (error) {
        console.error("Transfer counsellor work error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

//Assign trainers Subjects

export const assignTrainerSubjects = async (req, res) => {
    try {
        const { subjects } = req.body;

        if (!Array.isArray(subjects)) {
            return res.status(400).json({
                success: false,
                message: "Subjects must be an array"
            });
        }

        const trainer = await User.findOne({
            _id: req.params.id,
            role: "trainer"
        });

        if (!trainer) {
            return res.status(404).json({
                success: false,
                message: "Trainer not found"
            });
        }

        // Remove empty values and duplicate subjects
        const cleanedSubjects = [
            ...new Set(
                subjects
                    .map(subject => String(subject).trim())
                    .filter(Boolean)
            )
        ];

        trainer.subjects = cleanedSubjects;

        await trainer.save();

        res.status(200).json({
            success: true,
            message: "Trainer subjects updated successfully",
            trainer: {
                id: trainer._id,
                name: trainer.name,
                username: trainer.username,
                subjects: trainer.subjects
            }
        });

    } catch (error) {
        console.error(
            "Assign trainer subjects error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};