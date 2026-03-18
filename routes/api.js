const express = require('express');
const DataService = require('../services/dataService');
const CalculatorService = require('../services/calculatorService');

const router = express.Router();

function requireAuth(req, res, next) {
    if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// GET all subjects with analysis
router.get('/subjects', requireAuth, async (req, res) => {
    try {
        const [subjects, profile] = await Promise.all([
            DataService.getSubjects(req.auth.userId),
            DataService.getProfile(req.auth.userId)
        ]);
        const requirement = Number.isFinite(Number.parseFloat(profile && profile.attendance_requirement_percentage))
            ? Number.parseFloat(profile.attendance_requirement_percentage)
            : 75.0;
        const analyzed = subjects.map(s => CalculatorService.analyzeSubject(s, requirement));
        res.json(analyzed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET user profile
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const profile = await DataService.getProfile(req.auth.userId);
        res.json(profile);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE user profile
router.put('/profile', requireAuth, async (req, res) => {
    try {
        const { name, college, semester, attendance_requirement_percentage } = req.body;

        const profileUpdates = {};
        if (name !== undefined) profileUpdates.name = name;
        if (college !== undefined) profileUpdates.college = college;
        if (semester !== undefined) profileUpdates.semester = semester;

        if (attendance_requirement_percentage !== undefined) {
            const parsedRequirement = Number.parseFloat(attendance_requirement_percentage);
            if (!Number.isFinite(parsedRequirement)) {
                return res.status(400).json({ error: 'Invalid attendance requirement percentage' });
            }
            profileUpdates.attendance_requirement_percentage = parsedRequirement;
        }

        await DataService.updateProfile(req.auth.userId, profileUpdates);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single subject with stats and history
router.get('/subjects/:id', requireAuth, async (req, res) => {
    try {
        const [subject, profile] = await Promise.all([
            DataService.getSubjectById(req.auth.userId, req.params.id),
            DataService.getProfile(req.auth.userId)
        ]);
        if (!subject) return res.status(404).json({ error: 'Subject not found' });
        const requirement = Number.isFinite(Number.parseFloat(profile && profile.attendance_requirement_percentage))
            ? Number.parseFloat(profile.attendance_requirement_percentage)
            : 75.0;
        const analyzed = CalculatorService.analyzeSubject(subject, requirement);
        res.json({ subject: analyzed, history: subject.history });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST new subject
router.post('/subjects', requireAuth, async (req, res) => {
    try {
        const newSubject = await DataService.createSubject(req.auth.userId, req.body);
        res.status(201).json({ id: newSubject.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update subject
router.put('/subjects/:id', requireAuth, async (req, res) => {
    try {
        const data = await DataService.getUserData(req.auth.userId);
        const subjectIndex = data.subjects.findIndex(s => s.id === req.params.id);
        if (subjectIndex === -1) return res.status(404).json({ error: 'Subject not found' });

        const updatedFields = req.body;
        if (updatedFields.subject_name !== undefined) data.subjects[subjectIndex].subject_name = updatedFields.subject_name;
        if (updatedFields.faculty_name !== undefined) data.subjects[subjectIndex].faculty_name = updatedFields.faculty_name;
        if (updatedFields.min_requirement_percentage !== undefined) {
            const parsedRequirement = Number.parseFloat(updatedFields.min_requirement_percentage);
            if (!Number.isFinite(parsedRequirement)) {
                return res.status(400).json({ error: 'Invalid required percentage' });
            }
            data.subjects[subjectIndex].min_requirement_percentage = Math.min(100, Math.max(0, parsedRequirement));
        }

        await DataService.saveUserData(req.auth.userId, data);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE subject
router.delete('/subjects/:id', requireAuth, async (req, res) => {
    try {
        await DataService.deleteSubject(req.auth.userId, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST mark attendance
router.post('/attendance/mark', requireAuth, async (req, res) => {
    try {
        const { subjectId, status, date } = req.body;
        await DataService.markAttendance(req.auth.userId, subjectId, status, date);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE attendance record
router.delete('/attendance/:subjectId/:recordId', requireAuth, async (req, res) => {
    try {
        const success = await DataService.deleteAttendanceRecord(req.auth.userId, req.params.subjectId, req.params.recordId);
        if (!success) return res.status(404).json({ error: 'Record or subject not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Dashboard data
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const [subjects, profile] = await Promise.all([
            DataService.getSubjects(req.auth.userId),
            DataService.getProfile(req.auth.userId)
        ]);

        let totalAttended = 0;
        let totalClassesAll = 0;

        const requirement = Number.isFinite(Number.parseFloat(profile && profile.attendance_requirement_percentage))
            ? Number.parseFloat(profile.attendance_requirement_percentage)
            : 75.0;

        const analyzedSubjects = subjects.map(s => {
            totalAttended += s.attended_classes;
            totalClassesAll += s.total_classes;
            return CalculatorService.analyzeSubject(s, requirement);
        });

        const currentPercentage = CalculatorService.calculateAttendancePercentage(totalAttended, totalClassesAll);

        let overallStatus = 'safe';
        if (currentPercentage < requirement) overallStatus = 'danger';
        else if (currentPercentage - requirement <= 2) overallStatus = 'warning';

        res.json({
            profile,
            overall_percentage: currentPercentage,
            total_attended: totalAttended,
            total_classes: totalClassesAll,
            overall_status: overallStatus,
            subjects: analyzedSubjects
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/trend
router.get('/analytics/trend', requireAuth, async (req, res) => {
    try {
        const subjects = await DataService.getSubjects(req.auth.userId);
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - 30);
        let dailyStats = {};

        subjects.forEach(sub => {
            if (sub.history) {
                sub.history.forEach(record => {
                    const d = new Date(record.date);
                    if (d >= limitDate) {
                        const dateStr = record.date.substring(0, 10);
                        if (!dailyStats[dateStr]) dailyStats[dateStr] = { present: 0, absent: 0, total: 0 };
                        if (record.status === 'present' || record.status === 'extra') {
                            dailyStats[dateStr].present++;
                            dailyStats[dateStr].total++;
                        } else if (record.status === 'absent') {
                            dailyStats[dateStr].absent++;
                            dailyStats[dateStr].total++;
                        }
                    }
                });
            }
        });

        const sortedDates = Object.keys(dailyStats).sort();
        res.json(sortedDates.map(date => ({
            date,
            present: dailyStats[date].present,
            absent: dailyStats[date].absent,
            total: dailyStats[date].total
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/export
router.get('/export', requireAuth, async (req, res) => {
    try {
        const userData = await DataService.getUserData(req.auth.userId);
        res.setHeader('Content-disposition', `attachment; filename=attendify_backup_${req.auth.userId}.json`);
        res.setHeader('Content-type', 'application/json');
        res.send(JSON.stringify(userData, null, 2));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/import
router.post('/import', requireAuth, async (req, res) => {
    try {
        const incomingData = req.body;
        if (!incomingData || !incomingData.profile || !incomingData.subjects) {
            return res.status(400).json({ error: 'Invalid file format. Ensure it is a valid Attendify export.' });
        }
        await DataService.saveUserData(req.auth.userId, incomingData);
        res.json({ success: true, message: 'Data imported successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── TIMETABLE ───────────────────────────────────────────

// GET timetable (enriched with subject names)
router.get('/timetable', requireAuth, async (req, res) => {
    try {
        const [timetable, subjects] = await Promise.all([
            DataService.getTimetable(req.auth.userId),
            DataService.getSubjects(req.auth.userId)
        ]);
        const subjectMap = {};
        subjects.forEach(s => { subjectMap[s.id] = s.subject_name; });
        const enriched = timetable.map(slot => ({
            ...slot,
            subject_name: subjectMap[slot.subjectId] || 'Unknown'
        }));
        res.json(enriched);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST add timetable slot
router.post('/timetable', requireAuth, async (req, res) => {
    try {
        const { subjectId, day, startTime, endTime } = req.body;
        if (!subjectId || !day || !startTime || !endTime) {
            return res.status(400).json({ error: 'subjectId, day, startTime, endTime are required' });
        }
        const slot = await DataService.addTimetableSlot(req.auth.userId, { subjectId, day, startTime, endTime });
        res.status(201).json(slot);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE timetable slot
router.delete('/timetable/:id', requireAuth, async (req, res) => {
    try {
        await DataService.deleteTimetableSlot(req.auth.userId, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── COLLEGE LOCATION ────────────────────────────────────

// GET college location
router.get('/settings/location', requireAuth, async (req, res) => {
    try {
        const loc = await DataService.getCollegeLocation(req.auth.userId);
        res.json(loc || { lat: null, lng: null, radius: 150 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT save college location
router.put('/settings/location', requireAuth, async (req, res) => {
    try {
        const { lat, lng, radius } = req.body;
        if (lat == null || lng == null) {
            return res.status(400).json({ error: 'lat and lng are required' });
        }
        const saved = await DataService.saveCollegeLocation(req.auth.userId, { lat, lng, radius: radius || 150 });
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
