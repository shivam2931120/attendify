class CalculatorService {
    static calculateAttendancePercentage(attended, total) {
        if (total === 0) return 0;
        return Number(((attended / total) * 100).toFixed(2));
    }

    static calculateBuffer(attended, total, requiredPercentage) {
        const currentPercentage = this.calculateAttendancePercentage(attended, total);
        if (currentPercentage <= requiredPercentage) return 0;

        let safeToMiss = 0;
        while (this.calculateAttendancePercentage(attended, total + safeToMiss + 1) >= requiredPercentage) {
            safeToMiss++;
        }
        return safeToMiss;
    }

    static calculateRecovery(attended, total, requiredPercentage) {
        const currentPercentage = this.calculateAttendancePercentage(attended, total);
        if (currentPercentage >= requiredPercentage) return 0;

        let neededToAttend = 0;
        while (this.calculateAttendancePercentage(attended + neededToAttend, total + neededToAttend) < requiredPercentage) {
            neededToAttend++;
        }
        return neededToAttend;
    }

    static analyzeSubject(subject) {
        const { attended_classes, total_classes, min_requirement_percentage, subject_name } = subject;
        const currentPercentage = this.calculateAttendancePercentage(attended_classes, total_classes);

        let status = 'safe';
        let buffer = 0;
        let recovery = 0;

        if (currentPercentage >= min_requirement_percentage) {
            buffer = this.calculateBuffer(attended_classes, total_classes, min_requirement_percentage);
            if (buffer <= 2) {
                status = 'warning';
            }
        } else {
            status = 'danger';
            recovery = this.calculateRecovery(attended_classes, total_classes, min_requirement_percentage);
        }

        return {
            ...subject,
            current_percentage: currentPercentage,
            status,
            buffer_classes: buffer,
            recovery_classes: recovery
        };
    }
}

module.exports = CalculatorService;
