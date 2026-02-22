const { clerkClient } = require('@clerk/express');

// Default user data structure
function defaultUserData() {
    return {
        profile: {
            name: '',
            college: '',
            semester: '',
            attendance_requirement_percentage: 75.0
        },
        subjects: [],
        timetable: [],
        college_location: null  // { lat, lng, radius }
    };
}

class DataService {

    static async getUserData(userId) {
        try {
            const user = await clerkClient.users.getUser(userId);
            const meta = user.privateMetadata;
            if (!meta || !meta.attendify) {
                const data = defaultUserData();
                await clerkClient.users.updateUserMetadata(userId, {
                    privateMetadata: { attendify: data }
                });
                return data;
            }
            const d = meta.attendify;
            if (!d.profile) d.profile = defaultUserData().profile;
            if (!d.subjects) d.subjects = [];
            if (!d.timetable) d.timetable = [];
            if (d.college_location === undefined) d.college_location = null;
            return d;
        } catch (err) {
            console.error('Error reading Clerk metadata:', err);
            return defaultUserData();
        }
    }

    static async saveUserData(userId, userData) {
        try {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: { attendify: userData }
            });
        } catch (err) {
            console.error('Error writing Clerk metadata:', err);
            throw err;
        }
    }

    static async getProfile(userId) {
        const data = await this.getUserData(userId);
        return data.profile;
    }

    static async updateProfile(userId, profileUpdates) {
        const data = await this.getUserData(userId);
        data.profile = { ...data.profile, ...profileUpdates };
        await this.saveUserData(userId, data);
        return data.profile;
    }

    static async getSubjects(userId) {
        const data = await this.getUserData(userId);
        return data.subjects;
    }

    static async getSubjectById(userId, subjectId) {
        const subjects = await this.getSubjects(userId);
        return subjects.find(s => s.id === subjectId.toString());
    }

    static async createSubject(userId, subjectData) {
        const data = await this.getUserData(userId);
        const newSubject = {
            id: Date.now().toString(),
            subject_name: subjectData.subject_name,
            faculty_name: subjectData.faculty_name,
            min_requirement_percentage: parseFloat(subjectData.min_requirement_percentage),
            total_classes: parseInt(subjectData.total_classes) || 0,
            attended_classes: parseInt(subjectData.attended_classes) || 0,
            history: []
        };
        data.subjects.push(newSubject);
        await this.saveUserData(userId, data);
        return newSubject;
    }

    static async deleteSubject(userId, subjectId) {
        const data = await this.getUserData(userId);
        data.subjects = data.subjects.filter(s => s.id !== subjectId.toString());
        // Also remove timetable slots for this subject
        data.timetable = (data.timetable || []).filter(t => t.subjectId !== subjectId.toString());
        await this.saveUserData(userId, data);
    }

    static async deleteAttendanceRecord(userId, subjectId, recordId) {
        const data = await this.getUserData(userId);
        const subject = data.subjects.find(s => s.id === subjectId.toString());
        if (!subject) return false;

        const recordIndex = subject.history.findIndex(r => r.id === recordId.toString());
        if (recordIndex === -1) return false;

        const record = subject.history[recordIndex];
        if (record.status === 'present' || record.status === 'extra') {
            subject.attended_classes = Math.max(0, subject.attended_classes - 1);
            subject.total_classes = Math.max(0, subject.total_classes - 1);
        } else if (record.status === 'absent') {
            subject.total_classes = Math.max(0, subject.total_classes - 1);
        }

        subject.history.splice(recordIndex, 1);
        await this.saveUserData(userId, data);
        return true;
    }

    static async markAttendance(userId, subjectId, status, date) {
        const data = await this.getUserData(userId);
        const subject = data.subjects.find(s => s.id === subjectId.toString());
        if (!subject) throw new Error('Subject not found');

        const newRecord = {
            id: Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
            date: date,
            status: status
        };

        if (status === 'present' || status === 'extra') {
            subject.attended_classes += 1;
            subject.total_classes += 1;
        } else if (status === 'absent') {
            subject.total_classes += 1;
        }

        subject.history.push(newRecord);
        subject.history.sort((a, b) => new Date(b.date) - new Date(a.date));

        await this.saveUserData(userId, data);
        return newRecord;
    }

    // --- Timetable ---

    static async getTimetable(userId) {
        const data = await this.getUserData(userId);
        return data.timetable || [];
    }

    static async addTimetableSlot(userId, slot) {
        const data = await this.getUserData(userId);
        const newSlot = {
            id: Date.now().toString(),
            subjectId: slot.subjectId.toString(),
            day: slot.day,          // 'monday', 'tuesday', etc.
            startTime: slot.startTime, // 'HH:MM'
            endTime: slot.endTime      // 'HH:MM'
        };
        data.timetable = data.timetable || [];
        data.timetable.push(newSlot);
        await this.saveUserData(userId, data);
        return newSlot;
    }

    static async deleteTimetableSlot(userId, slotId) {
        const data = await this.getUserData(userId);
        data.timetable = (data.timetable || []).filter(t => t.id !== slotId.toString());
        await this.saveUserData(userId, data);
    }

    // --- College Location ---

    static async getCollegeLocation(userId) {
        const data = await this.getUserData(userId);
        return data.college_location || null;
    }

    static async saveCollegeLocation(userId, location) {
        const data = await this.getUserData(userId);
        data.college_location = {
            lat: parseFloat(location.lat),
            lng: parseFloat(location.lng),
            radius: parseInt(location.radius) || 150
        };
        await this.saveUserData(userId, data);
        return data.college_location;
    }
}

module.exports = DataService;
