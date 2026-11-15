// ============================================
// 세션 대체 이미지 (명세 3.2, 7.4)
//
// 파일 선택 → canvas로 긴 변 384px 이하로 줄이기(JPEG 0.85) → setSessionImage.
// 저장소는 크기를 줄여 주지 않으므로 반드시 여기서 줄여서 넘긴다.
// 실패하면 토스트만 띄우고 기존 이미지는 그대로 둔다.
// ============================================

import { getSessionImage, setSessionImage } from '../../data/sessionStore.js';
import { charAvatarUrl } from '../../utils/avatarUrl.js';
import { showToast } from '../notifications.js';

/** 봇 이미지도 못 불러올 때 쓰는 ST 기본 이미지 */
const FALLBACK_IMAGE = '/img/ai4.png';

/**
 * 세션 카드/줄에 보여줄 이미지 주소: 세션 이미지가 있으면 그것, 없으면 봇 이미지
 * @param {string} avatar
 * @param {string|null} sessionId - 가상 세션(전체/미분류)이면 null
 * @returns {string}
 */
export function getSessionImageSrc(avatar, sessionId) {
    return (sessionId && getSessionImage(sessionId)) || charAvatarUrl(avatar);
}

/**
 * root 안의 이미지가 깨지면 기본 이미지로 바꾼다 (error는 버블링하지 않아 요소마다 건다)
 * @param {ParentNode} root
 */
export function bindImageFallback(root) {
    root.querySelectorAll('img[data-session-img]').forEach((img) => {
        img.addEventListener('error', () => {
            if (img.dataset.fellBack) return;
            img.dataset.fellBack = '1';
            img.src = FALLBACK_IMAGE;
        }, { once: true });
    });
}

export const SESSION_IMAGE_MAX_SIDE = 384;
export const SESSION_IMAGE_QUALITY = 0.85;

/**
 * Blob/File을 이미지 요소 또는 비트맵으로 디코드
 * @param {Blob} blob
 * @returns {Promise<{ source: CanvasImageSource, width: number, height: number, release: Function }>}
 */
async function decodeImage(blob) {
    if (typeof createImageBitmap === 'function') {
        try {
            const bitmap = await createImageBitmap(blob);
            return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close?.() };
        } catch { /* 일부 형식은 비트맵 디코드가 실패 → <img>로 재시도 */ }
    }
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
            img.src = url;
        });
        return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
    } catch (e) {
        URL.revokeObjectURL(url);
        throw e;
    }
}

/**
 * 이미지를 줄여서 JPEG dataURL로 (작은 이미지는 키우지 않는다)
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export async function downscaleToJpegDataUrl(blob) {
    if (!blob || !String(blob.type || '').startsWith('image/')) {
        throw new Error('이미지 파일이 아닙니다.');
    }
    const decoded = await decodeImage(blob);
    try {
        const { width, height } = decoded;
        if (!width || !height) throw new Error('이미지 크기를 알 수 없습니다.');

        const scale = Math.min(1, SESSION_IMAGE_MAX_SIDE / Math.max(width, height));
        const w = Math.max(1, Math.round(width * scale));
        const h = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        // JPEG는 투명을 지원하지 않아 검게 나오므로 흰 바탕을 먼저 깐다
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(decoded.source, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', SESSION_IMAGE_QUALITY);
        if (!dataUrl.startsWith('data:image/jpeg')) throw new Error('이미지를 변환하지 못했습니다.');
        return dataUrl;
    } finally {
        decoded.release();
    }
}

/**
 * 파일을 줄여서 세션 이미지로 저장
 * @param {string} sessionId
 * @param {Blob} file
 * @returns {Promise<boolean>} 저장했는지
 */
export async function setSessionImageFromFile(sessionId, file) {
    try {
        const dataUrl = await downscaleToJpegDataUrl(file);
        setSessionImage(sessionId, dataUrl);
        return true;
    } catch (e) {
        console.error('[Sessions] Failed to set session image:', e);
        showToast('이미지를 불러오지 못했습니다. 기존 이미지는 그대로 둡니다.', 'error');
        return false;
    }
}

/**
 * 파일 선택 창을 열어 세션 이미지 바꾸기
 * @param {string} sessionId
 * @returns {Promise<boolean>} 바꿨는지 (선택 취소/실패는 false)
 */
export function pickSessionImage(sessionId) {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            input.remove();
            resolve(value);
        };
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return finish(false);
            const ok = await setSessionImageFromFile(sessionId, file);
            if (ok) showToast('세션 이미지를 바꿨습니다.', 'success');
            finish(ok);
        }, { once: true });
        // 선택 창을 취소하면 change가 오지 않는다 (cancel 이벤트를 지원하는 브라우저에서만 정리)
        input.addEventListener('cancel', () => finish(false), { once: true });
        document.body.appendChild(input);
        input.click();
    });
}
