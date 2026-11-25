import Complaint from "../models/Complaint.js";
import Batch from "../models/Batch.js";
import User from "../models/User.js";

const STAFF_ROLES = ["admin", "counsellor", "trainer"];
const COMPLAINT_RETENTION_MS = 24 * 60 * 60 * 1000;

const getAvailableRecipients = async (student) => {
    const assignedTrainerIds = student.trainer
        ? [student.trainer]
        : await Batch.find({
            active: true,
            $or: [
                { students: student._id },
                ...(student.batch ? [{ _id: student.batch }] : [])
            ]
        }).distinct("trainer");

    const assignedIds = [
        student.counsellor ? { role: "counsellor", id: student.counsellor } : null,
        ...assignedTrainerIds.map((id) => ({ role: "trainer", id }))
    ].filter(Boolean);

    const users = await User.find({
        status: "active",
        $or: [
            { role: "admin" },
            ...assignedIds.map(({ role, id }) => ({ role, _id: id }))
        ]
    }).select("_id name role");

    return users;
};

const formatComplaint = (complaint) => {
    const recipients = complaint.recipients.map((recipient) => ({
        role: recipient.role,
        name: recipient.user?.name || "Staff member",
        response: recipient.response,
        resolvedAt: recipient.resolvedAt
    }));

    return {
        id: complaint._id,
        title: complaint.title,
        description: complaint.description,
        createdAt: complaint.createdAt,
        resolvedAt: complaint.resolvedAt,
        deleteAt: complaint.deleteAt,
        status: complaint.resolvedAt ? "resolved" : "open",
        recipients
    };
};

export const getStudentComplaintOptions = async (req, res) => {
    try {
        const users = await getAvailableRecipients(req.student);
        const options = STAFF_ROLES.flatMap((role) => {
            const roleUsers = users.filter((user) => user.role === role);
            if (!roleUsers.length) return [];

            const roleLabel = role === "counsellor"
                ? "Counsellor"
                : role === "trainer"
                    ? "Trainer"
                    : role;
            return [{
                role,
                label: role === "admin"
                    ? `${roleUsers.length === 1 ? "Admin" : "Admins"} (${roleUsers.length})`
                    : `My ${roleLabel} (${roleUsers[0].name})`,
                count: roleUsers.length
            }];
        });

        return res.status(200).json({ success: true, options });
    } catch (error) {
        console.error("Get complaint recipient options error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch complaint recipients"
        });
    }
};

export const getStudentComplaints = async (req, res) => {
    try {
        const complaints = await Complaint.find({
            student: req.student._id,
            $or: [{ deleteAt: null }, { deleteAt: { $gt: new Date() } }]
        })
            .populate("recipients.user", "name")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            complaints: complaints.map(formatComplaint)
        });
    } catch (error) {
        console.error("Get student complaints error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch complaints"
        });
    }
};

export const createStudentComplaint = async (req, res) => {
    try {
        const { title, description, roles } = req.body ?? {};

        if (
            typeof title !== "string" ||
            title.trim().length < 3 ||
            title.trim().length > 120 ||
            typeof description !== "string" ||
            description.trim().length < 5 ||
            description.trim().length > 3000
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a title (3–120 characters) and description (5–3000 characters)"
            });
        }

        if (
            !Array.isArray(roles) ||
            !roles.length ||
            roles.some((role) => !STAFF_ROLES.includes(role)) ||
            new Set(roles).size !== roles.length
        ) {
            return res.status(400).json({
                success: false,
                message: "Select one or more valid complaint recipients"
            });
        }

        const availableUsers = await getAvailableRecipients(req.student);
        if (roles.some((role) => !availableUsers.some((user) => user.role === role))) {
            return res.status(400).json({
                success: false,
                message: "One or more selected recipients are no longer available"
            });
        }

        const recipients = availableUsers
            .filter((user) => roles.includes(user.role))
            .map((user) => ({ user: user._id, role: user.role }));
        if (!recipients.length) {
            return res.status(400).json({
                success: false,
                message: "One or more selected recipients are no longer available"
            });
        }

        const complaint = await Complaint.create({
            student: req.student._id,
            title: title.trim(),
            description: description.trim(),
            recipients
        });
        await complaint.populate("recipients.user", "name");

        return res.status(201).json({
            success: true,
            complaint: formatComplaint(complaint)
        });
    } catch (error) {
        console.error("Create student complaint error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to submit complaint"
        });
    }
};

export const getStaffComplaints = async (req, res) => {
    try {
        const complaints = await Complaint.find({
            recipients: { $elemMatch: { user: req.user._id } },
            $or: [{ deleteAt: null }, { deleteAt: { $gt: new Date() } }]
        })
            .populate("student", "name course")
            .populate("recipients.user", "name")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            complaints: complaints.map((complaint) => ({
                ...formatComplaint(complaint),
                student: complaint.student
                    ? { name: complaint.student.name, course: complaint.student.course }
                    : { name: "Former student", course: "" },
                myRecipient: complaint.recipients.find(
                    (recipient) => recipient.user?._id.toString() === req.user._id.toString()
                )
            }))
        });
    } catch (error) {
        console.error("Get staff complaints error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch complaints"
        });
    }
};

export const respondToComplaint = async (req, res) => {
    try {
        const { response, resolved } = req.body ?? {};
        if (typeof response !== "string" || !response.trim() || response.trim().length > 3000) {
            return res.status(400).json({
                success: false,
                message: "Write a resolution (up to 3000 characters) before resolving"
            });
        }
        if (typeof resolved !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "Choose whether to mark this response resolved"
            });
        }

        const responseAt = new Date();
        const complaint = await Complaint.findOneAndUpdate({
            _id: req.params.id,
            recipients: { $elemMatch: { user: req.user._id, resolvedAt: null } },
            $or: [{ deleteAt: null }, { deleteAt: { $gt: new Date() } }]
        }, {
            $set: {
                "recipients.$.response": response.trim(),
                "recipients.$.resolvedAt": resolved ? responseAt : null
            }
        }, { new: true });

        if (!complaint) {
            const existingAssignment = await Complaint.exists({
                _id: req.params.id,
                recipients: { $elemMatch: { user: req.user._id } },
                $or: [{ deleteAt: null }, { deleteAt: { $gt: new Date() } }]
            });
            return res.status(existingAssignment ? 409 : 404).json({
                success: false,
                message: existingAssignment
                    ? "Your response has already been resolved"
                    : "Complaint not found"
            });
        }

        if (complaint.recipients.every((entry) => entry.resolvedAt)) {
            const resolvedAt = new Date();
            await Complaint.updateOne({
                _id: complaint._id,
                resolvedAt: null,
                recipients: { $not: { $elemMatch: { resolvedAt: null } } }
            }, {
                $set: {
                    resolvedAt,
                    deleteAt: new Date(resolvedAt.getTime() + COMPLAINT_RETENTION_MS)
                }
            });
        }

        const savedComplaint = await Complaint.findById(complaint._id)
            .populate("recipients.user", "name");

        return res.status(200).json({
            success: true,
            complaint: formatComplaint(savedComplaint)
        });
    } catch (error) {
        console.error("Respond to complaint error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to save complaint response"
        });
    }
};
