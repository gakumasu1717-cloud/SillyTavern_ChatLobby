// ============================================
// 전역 작업 Lock 싱글톤
// 채팅 열기 등 SillyTavern API를 호출하는 작업이
// 동시에 여러 개 실행되지 않도록 직렬화
// ============================================

class OperationLock {
    constructor() {
        /** @type {boolean} */
        this._locked = false;
        /** @type {string|null} */
        this._currentOp = null;
        /** @type {ReturnType<setTimeout>|null} */
        this._safetyTimer = null;
    }

    /** 현재 잠금 상태 */
    get isLocked() { return this._locked; }

    /** 현재 실행 중인 작업명 */
    get currentOp() { return this._currentOp; }

    /**
     * Lock 획득 시도
     * @param {string} opName - 작업 이름 (디버그용)
     * @param {number} timeout - 안전 해제 타임아웃 (ms)
     * @returns {boolean} - 획득 성공 여부
     */
    acquire(opName, timeout = 8000) {
        if (this._locked) {
            console.warn(`[OperationLock] Blocked: "${opName}" (running: "${this._currentOp}")`);
            return false;
        }
        this._locked = true;
        this._currentOp = opName;

        // Safety timeout - 어떤 경우에도 해제
        this._safetyTimer = setTimeout(() => {
            console.warn(`[OperationLock] Safety release: "${opName}" timed out (${timeout}ms)`);
            this.release();
        }, timeout);

        return true;
    }

    /**
     * Lock 해제
     */
    release() {
        this._locked = false;
        this._currentOp = null;
        if (this._safetyTimer) {
            clearTimeout(this._safetyTimer);
            this._safetyTimer = null;
        }
    }
}

export const operationLock = new OperationLock();
