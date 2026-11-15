// ============================================
// 같은 분기 묶음 찾기
//
// 분기 분석(branchCache)이 남긴 parentChat 관계를 따라가서
// 어떤 채팅의 "뿌리 + 모든 후손"을 구한다.
// 파일명은 .jsonl 유무가 섞여 들어오므로 전부 떼고 비교한다.
// ============================================

import { getAllBranches, getAllFingerprints } from '../data/branchCache.js';

const stripExt = (name) => (typeof name === 'string' ? name.replace(/\.jsonl$/i, '') : '');

/**
 * 같은 분기에 속한 채팅 이름들 (.jsonl 없는 형태)
 *
 * 부모가 이미 지워졌어도 이름은 그대로 결과에 들어간다 (실제 목록과의 교집합은 호출한 쪽이 한다).
 * 분기 분석이 한 번도 돈 적 없는 캐릭터는 null — "분석 안 됨"과 "분기 없음"을 구분하기 위해
 * 지문(fingerprint)도 함께 본다. 분석은 됐는데 분기가 없으면 자기 자신만 든 Set이 돌아온다.
 *
 * @param {string} avatar
 * @param {string} fileName
 * @returns {Set<string>|null}
 */
export function getBranchFamily(avatar, fileName) {
    const self = stripExt(fileName);
    if (!avatar || !self) return null;

    const branches = getAllBranches(avatar) || {};
    const parentOf = new Map();
    for (const [child, info] of Object.entries(branches)) {
        const c = stripExt(child);
        const p = stripExt(info?.parentChat);
        if (c && p && c !== p) parentOf.set(c, p);
    }

    if (parentOf.size === 0 && Object.keys(getAllFingerprints(avatar) || {}).length === 0) {
        return null;
    }

    // 뿌리까지 올라간다 (순환 데이터가 있어도 멈추도록 방문 기록)
    let root = self;
    const seen = new Set([root]);
    while (parentOf.has(root)) {
        const next = parentOf.get(root);
        if (seen.has(next)) break;
        seen.add(next);
        root = next;
    }

    const children = new Map();
    for (const [c, p] of parentOf) {
        if (!children.has(p)) children.set(p, []);
        children.get(p).push(c);
    }

    // 뿌리에서 아래로 내려가며 모든 후손 수집
    const family = new Set([root]);
    const queue = [root];
    while (queue.length) {
        const cur = queue.shift();
        for (const child of children.get(cur) || []) {
            if (!family.has(child)) {
                family.add(child);
                queue.push(child);
            }
        }
    }
    family.add(self);
    return family;
}
