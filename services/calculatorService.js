class CalculatorService {
    static normalizePercentage(value, fallback = 75.0) {
        const parsed = Number.parseFloat(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.min(100, Math.max(0, parsed));
    }

    static calculateAttendancePercentage(attended, total) {
        const parsedAttended = Number(attended) || 0;
        const parsedTotal = Number(total) || 0;
        if (parsedTotal <= 0) return 0;
        return Number(((parsedAttended / parsedTotal) * 100).toFixed(2));
    }

    static calculateBuffer(attended, total, requiredPercentage) {
        const req = this.normalizePercentage(requiredPercentage, 75.0);
        if (req <= 0) return 0;

        const parsedAttended = Number(attended) || 0;
        const parsedTotal = Number(total) || 0;
        const currentPercentage = this.calculateAttendancePercentage(parsedAttended, parsedTotal);
        if (currentPercentage <= req) return 0;

        const safeToMiss = Math.floor((parsedAttended * 100 / req) - parsedTotal);
        return Math.max(0, safeToMiss);
    }

    static calculateRecovery(attended, total, requiredPercentage) {
        const req = this.normalizePercentage(requiredPercentage, 75.0);
        const effectiveReq = req >= 100 ? 99.99 : req;

        const parsedAttended = Number(attended) || 0;
        const parsedTotal = Number(total) || 0;
        const currentPercentage = this.calculateAttendancePercentage(parsedAttended, parsedTotal);
        if (currentPercentage >= effectiveReq) return 0;

        const neededToAttend = Math.ceil((effectiveReq * parsedTotal - 100 * parsedAttended) / (100 - effectiveReq));
        return Math.max(0, neededToAttend);
    }

    static analyzeSubject(subject, fallbackRequirement = 75.0) {
        const attended = Number(subject.attended_classes) || 0;
        const total = Number(subject.total_classes) || 0;
        const requirement = this.normalizePercentage(subject.min_requirement_percentage, fallbackRequirement);
        const currentPercentage = this.calculateAttendancePercentage(attended, total);

        let status = 'safe';
        let buffer = 0;
        let recovery = 0;

        if (currentPercentage >= requirement) {
            buffer = this.calculateBuffer(attended, total, requirement);
            if (buffer <= 2) {
                status = 'warning';
            }
        } else {
            status = 'danger';
            recovery = this.calculateRecovery(attended, total, requirement);
        }

        return {
            ...subject,
            attended_classes: attended,
            total_classes: total,
            min_requirement_percentage: requirement,
            current_percentage: currentPercentage,
            status,
            buffer_classes: buffer,
            recovery_classes: recovery
        };
    }
}

module.exports = CalculatorService;
