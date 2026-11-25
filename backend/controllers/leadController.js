import Lead from "../models/Lead.js";
import User from "../models/User.js";


// ==========================================
// CREATE LEAD
// ==========================================

export const createLead = async (req, res) => {
    try {
        const {
            studentName,
            phone,
            course,
            assignedCounsellor
        } = req.body;

        // Required fields
        if (!studentName || !phone || !course) {
            return res.status(400).json({
                success: false,
                message: "Student name, phone and course are required"
            });
        }

        // If counsellor is provided, verify it
        if (assignedCounsellor) {

            const counsellor = await User.findById(
                assignedCounsellor
            );

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

            if (counsellor.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "Counsellor account is inactive"
                });
            }

            if (counsellor.employmentStatus === "on_leave") {
                return res.status(400).json({
                    success: false,
                    message: "Counsellor is currently on leave"
                });
            }
        }

        const lead = await Lead.create({
            studentName,
            phone,
            course,
            assignedCounsellor: assignedCounsellor || null
        });

        const populatedLead = await Lead.findById(lead._id)
            .populate(
                "assignedCounsellor",
                "name email phone username"
            );

        res.status(201).json({
            success: true,
            message: "Lead created successfully",
            lead: populatedLead
        });

    } catch (error) {

        console.error("Create lead error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// ==========================================
// GET ALL LEADS
// ==========================================

export const getLeads = async (req, res) => {
    try {

        const leads = await Lead.find()
            .populate(
                "assignedCounsellor",
                "name email phone username employmentStatus"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: leads.length,
            leads
        });

    } catch (error) {

        console.error("Get leads error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// ==========================================
// GET ONE LEAD
// ==========================================

export const getLeadById = async (req, res) => {
    try {

        const lead = await Lead.findById(req.params.id)
            .populate(
                "assignedCounsellor",
                "name email phone username employmentStatus"
            );

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found"
            });
        }

        res.status(200).json({
            success: true,
            lead
        });

    } catch (error) {

        console.error("Get lead error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// ==========================================
// UPDATE LEAD
// ==========================================

export const updateLead = async (req, res) => {
    try {

        const lead = await Lead.findById(req.params.id);

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found"
            });
        }

        const {
            studentName,
            phone,
            course,
            assignedCounsellor
        } = req.body;

        if (studentName) {
            lead.studentName = studentName;
        }

        if (phone) {
            lead.phone = phone;
        }

        if (course) {
            lead.course = course;
        }

        if (assignedCounsellor !== undefined) {
            if (!assignedCounsellor) {
                lead.assignedCounsellor = null;
            } else if (String(assignedCounsellor) === String(lead.assignedCounsellor ?? "")) {
                lead.assignedCounsellor = assignedCounsellor;
            } else {
                const counsellor = await User.findById(assignedCounsellor);

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

                if (counsellor.status !== "active") {
                    return res.status(400).json({
                        success: false,
                        message: "Counsellor is inactive"
                    });
                }

                if (counsellor.employmentStatus === "on_leave") {
                    return res.status(400).json({
                        success: false,
                        message: "Counsellor is on leave"
                    });
                }

                lead.assignedCounsellor = assignedCounsellor;
            }
        }

        await lead.save();

        const updatedLead = await Lead.findById(lead._id)
            .populate(
                "assignedCounsellor",
                "name email phone username"
            );

        res.status(200).json({
            success: true,
            message: "Lead updated successfully",
            lead: updatedLead
        });

    } catch (error) {

        console.error("Update lead error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// ==========================================
// DELETE LEAD
// ==========================================

export const deleteLead = async (req, res) => {
    try {

        const lead = await Lead.findById(req.params.id);

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found"
            });
        }

        await lead.deleteOne();

        res.status(200).json({
            success: true,
            message: "Lead deleted successfully"
        });

    } catch (error) {

        console.error("Delete lead error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

export const recordLeadFollowUp = async (req, res) => {
    try {
        const { channel } = req.body;
        if (!["call", "whatsapp"].includes(channel)) {
            return res.status(400).json({
                success: false,
                message: "Follow-up channel must be call or whatsapp"
            });
        }

        const leadFilter = { _id: req.params.id };
        if (req.user.role === "counsellor") {
            leadFilter.assignedCounsellor = req.user._id;
        }

        const lead = await Lead.findOneAndUpdate(
            leadFilter,
            {
                $inc: { [`followUpCounts.${channel}`]: 1 },
                $push: { followUpHistory: { channel, followedUpAt: new Date() } }
            },
            { new: true, runValidators: true }
        );

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: req.user.role === "counsellor"
                    ? "Lead not found or not assigned to you"
                    : "Lead not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Follow-up recorded",
            lead
        });
    } catch (error) {
        console.error("Record lead follow-up error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Counsellers

export const getMyLeads = async (req, res) => {
    try {
        const leads = await Lead.find({
            assignedCounsellor: req.user._id
        })
            .populate(
                "assignedCounsellor",
                "name username email employmentStatus"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: leads.length,
            leads
        });

    } catch (error) {
        console.error("Get my leads error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

//Counsellers get their leads

export const getMyLeadById = async (req, res) => {
    try {
        const lead = await Lead.findOne({
            _id: req.params.id,
            assignedCounsellor: req.user._id
        }).populate(
            "assignedCounsellor",
            "name username email employmentStatus"
        );

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found or not assigned to you"
            });
        }

        res.status(200).json({
            success: true,
            lead
        });

    } catch (error) {
        console.error("Get my lead error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

export const updateMyLead = async (req, res) => {
    try {
        const lead = await Lead.findOne({
            _id: req.params.id,
            assignedCounsellor: req.user._id
        });

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found or not assigned to you"
            });
        }

        if (lead.status === "converted") {
            return res.status(400).json({
                success: false,
                message: "An enrolled lead cannot be edited"
            });
        }

        const { studentName, phone, course } = req.body;
        const fields = { studentName, phone, course };

        for (const [field, value] of Object.entries(fields)) {
            if (value !== undefined) {
                if (typeof value !== "string" || !value.trim()) {
                    return res.status(400).json({
                        success: false,
                        message: `${field} cannot be empty`
                    });
                }
                if (field === "phone" && value.trim().length < 6) {
                    return res.status(400).json({
                        success: false,
                        message: "Phone number must be at least 6 characters"
                    });
                }
                lead[field] = value.trim();
            }
        }

        await lead.save();
        const updatedLead = await Lead.findById(lead._id).populate(
            "assignedCounsellor",
            "name username email employmentStatus"
        );

        return res.status(200).json({
            success: true,
            message: "Lead updated successfully",
            lead: updatedLead
        });
    } catch (error) {
        console.error("Update my lead error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// update leads status

export const updateMyLeadStatus = async (req, res) => {
    try {
        const { status } = req.body;

        // Counselor cannot mark a lead as converted here.
        // Conversion must happen through the
        // convertLeadToStudent endpoint.
        const allowedStatuses = [
            "pending",
            "contacted",
            "follow_up",
            "lost"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid status. Use pending, contacted, follow_up or lost. Use the conversion endpoint to convert a lead."
            });
        }

        const lead = await Lead.findOne({
            _id: req.params.id,
            assignedCounsellor: req.user._id
        });

        if (!lead) {
            return res.status(404).json({
                success: false,
                message:
                    "Lead not found or not assigned to you"
            });
        }

        // Don't allow changes to an already converted lead
        if (lead.status === "converted") {
            return res.status(400).json({
                success: false,
                message: "Converted lead cannot be modified"
            });
        }

        lead.status = status;

        // A non-converted lead should not have convertedAt
        lead.convertedAt = null;

        await lead.save();

        res.status(200).json({
            success: true,
            message: "Lead status updated successfully",
            lead
        });

    } catch (error) {
        console.error(
            "Update my lead status error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};