import mongoose from "mongoose";
import ClassCalendar from "../models/ClassCalendar.js";
import Batch from "../models/Batch.js";

const VALID_EVENT_TYPES = [
    "holiday",
    "meeting",
    "occasion",
    "class_cancelled",
    "other"
];

// Validate YYYY-MM-DD and reject impossible dates
const isValidDate = (date) => {
    if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        return false;
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date
    );
};

// Validate event type
const isValidEventType = (type) => {
    return VALID_EVENT_TYPES.includes(type);
};

// Validate batch ownership
const getTrainerBatch = async (batchId, trainerId) => {
    if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return null;
    }

    return Batch.findOne({
        _id: batchId,
        trainer: trainerId,
        active: true
    });
};

// Check whether an event overlaps another event
// All-batch events overlap every batch-specific event.
// Different batch-specific events can exist on the same date.
const hasOverlappingEvent = async ({
    trainerId,
    date,
    batchId,
    excludeEventId = null
}) => {
    const filter = {
        trainer: trainerId,
        date
    };

    if (excludeEventId) {
        filter._id = { $ne: excludeEventId };
    }

    const existingEvents = await ClassCalendar.find(filter)
        .select("batch")
        .lean();

    return existingEvents.some((event) => {
        const existingBatchId = event.batch
            ? event.batch.toString()
            : null;

        return (
            existingBatchId === null ||
            batchId === null ||
            existingBatchId === batchId
        );
    });
};


// CREATE CALENDAR EVENT
// POST /api/trainer/calendar

export const createCalendarEvent = async (req, res) => {
    try {
        const {
            date,
            type,
            reason,
            batch
        } = req.body;

        if (!date || !type || !reason) {
            return res.status(400).json({
                success: false,
                message: "Date, event type and reason are required"
            });
        }

        if (!isValidDate(date)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date. Use YYYY-MM-DD format."
            });
        }

        if (!isValidEventType(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid calendar event type"
            });
        }

        if (
            typeof reason !== "string" ||
            !reason.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid reason is required"
            });
        }

        // batch omitted or null means all trainer batches
        let batchId = null;

        if (batch !== undefined && batch !== null) {
            if (!mongoose.Types.ObjectId.isValid(batch)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid batch ID"
                });
            }

            const trainerBatch = await getTrainerBatch(
                batch,
                req.user._id
            );

            if (!trainerBatch) {
                return res.status(404).json({
                    success: false,
                    message: "Active batch not found or does not belong to you"
                });
            }

            batchId = trainerBatch._id;
        }

        const overlap = await hasOverlappingEvent({
            trainerId: req.user._id,
            date,
            batchId: batchId ? batchId.toString() : null
        });

        if (overlap) {
            return res.status(409).json({
                success: false,
                message:
                    "A calendar event already exists for this date and scope. An all-batch event cannot overlap with a batch-specific event."
            });
        }

        const event = await ClassCalendar.create({
            trainer: req.user._id,
            batch: batchId,
            date,
            type,
            reason: reason.trim()
        });

        const populatedEvent = await ClassCalendar.findById(event._id)
            .populate("batch", "name startTime endTime");

        return res.status(201).json({
            success: true,
            message: "Calendar event created successfully",
            event: populatedEvent
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A calendar event already exists for this date and scope"
            });
        }

        console.error("Create calendar event error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// GET TRAINER CALENDAR
// GET /api/trainer/calendar

export const getMyCalendar = async (req, res) => {
    try {
        const {
            date,
            startDate,
            endDate,
            batchId
        } = req.query;

        const filter = {
            trainer: req.user._id
        };

        if (date) {
            if (!isValidDate(date)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid date. Use YYYY-MM-DD format."
                });
            }

            filter.date = date;
        } else if (startDate || endDate) {
            filter.date = {};

            if (startDate) {
                if (!isValidDate(startDate)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid start date"
                    });
                }

                filter.date.$gte = startDate;
            }

            if (endDate) {
                if (!isValidDate(endDate)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid end date"
                    });
                }

                filter.date.$lte = endDate;
            }

            if (
                startDate &&
                endDate &&
                startDate > endDate
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Start date cannot be after end date"
                });
            }
        }

        if (batchId) {
            const trainerBatch = await getTrainerBatch(
                batchId,
                req.user._id
            );

            if (!trainerBatch) {
                return res.status(404).json({
                    success: false,
                    message: "Batch not found or does not belong to you"
                });
            }

            // Include events for this batch AND all-batch events
            filter.$or = [
                { batch: null },
                { batch: trainerBatch._id }
            ];
        }

        const events = await ClassCalendar.find(filter)
            .populate("batch", "name startTime endTime")
            .sort({ date: 1, createdAt: 1 });

        return res.status(200).json({
            success: true,
            count: events.length,
            events
        });

    } catch (error) {
        console.error("Get calendar error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// UPDATE CALENDAR EVENT
// PUT /api/trainer/calendar/:id

export const updateCalendarEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            date,
            type,
            reason
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid calendar event ID"
            });
        }

        const event = await ClassCalendar.findOne({
            _id: id,
            trainer: req.user._id
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Calendar event not found"
            });
        }

        const newDate = date !== undefined ? date : event.date;
        const newType = type !== undefined ? type : event.type;
        const newReason = reason !== undefined ? reason : event.reason;

        if (!isValidDate(newDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date. Use YYYY-MM-DD format."
            });
        }

        if (!isValidEventType(newType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid calendar event type"
            });
        }

        if (
            typeof newReason !== "string" ||
            !newReason.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid reason is required"
            });
        }

        // Keep existing scope unless batch is explicitly supplied.
        let newBatchId = event.batch
            ? event.batch.toString()
            : null;

        if (Object.prototype.hasOwnProperty.call(req.body, "batch")) {
            if (req.body.batch === null) {
                newBatchId = null;
            } else {
                if (
                    typeof req.body.batch !== "string" ||
                    !mongoose.Types.ObjectId.isValid(req.body.batch)
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid batch ID"
                    });
                }

                const trainerBatch = await getTrainerBatch(
                    req.body.batch,
                    req.user._id
                );

                if (!trainerBatch) {
                    return res.status(404).json({
                        success: false,
                        message: "Active batch not found or does not belong to you"
                    });
                }

                newBatchId = trainerBatch._id.toString();
            }
        }

        const overlap = await hasOverlappingEvent({
            trainerId: req.user._id,
            date: newDate,
            batchId: newBatchId,
            excludeEventId: event._id
        });

        if (overlap) {
            return res.status(409).json({
                success: false,
                message: "This update would overlap with another calendar event"
            });
        }

        event.date = newDate;
        event.type = newType;
        event.reason = newReason.trim();
        event.batch = newBatchId;

        await event.save();

        const updatedEvent = await ClassCalendar.findById(event._id)
            .populate("batch", "name startTime endTime");

        return res.status(200).json({
            success: true,
            message: "Calendar event updated successfully",
            event: updatedEvent
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A calendar event already exists for this date and scope"
            });
        }

        console.error("Update calendar event error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


// DELETE CALENDAR EVENT
// DELETE /api/trainer/calendar/:id

export const deleteCalendarEvent = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid calendar event ID"
            });
        }

        const event = await ClassCalendar.findOne({
            _id: id,
            trainer: req.user._id
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Calendar event not found"
            });
        }

        await event.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Calendar event deleted successfully"
        });

    } catch (error) {
        console.error("Delete calendar event error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};