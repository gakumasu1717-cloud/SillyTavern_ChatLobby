// ============================================
// Interval 메모리 누수 방지 관리자
// ============================================

/**
 * setInterval 중앙 관리
 * 로비 닫을 때 clearAll()로 모든 interval 정리
 */
class IntervalManager {
    constructor() {
        /** @type {Set<number>} */
        this.intervals = new Set();
    }
    
    /**
     * setInterval 대신 사용
     * @param {Function} callback
     * @param {number} delay
     * @returns {number} interval ID
     */
    set(callback, delay) {
        const id = setInterval(callback, delay);
        this.intervals.add(id);
        console.log('[IntervalManager] Created interval:', id, 'Total:', this.intervals.size);
        return id;
    }
    
    /**
     * 개별 interval 정리
     * @param {number} id
     */
    clear(id) {
        if (this.intervals.has(id)) {
            clearInterval(id);
            this.intervals.delete(id);
            console.log('[IntervalManager] Cleared interval:', id, 'Remaining:', this.intervals.size);
        }
    }
    
    /**
     * 모든 interval 정리 (로비 닫을 때 호출)
     */
    clearAll() {
        if (this.intervals.size > 0) {
            console.log('[IntervalManager] Clearing all intervals:', this.intervals.size);
            this.intervals.forEach(id => clearInterval(id));
            this.intervals.clear();
            console.log('[IntervalManager] 🧹 All intervals cleared');
        }
    }
    
    /**
     * 활성 interval 수
     * @returns {number}
     */
    get count() {
        return this.intervals.size;
    }
}

export const intervalManager = new IntervalManager();
