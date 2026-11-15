"""리팩토링 검증: 옮긴 함수가 원본과 글자 단위로 같은지 확인.

    python tests/tools/compare-functions.py <git-ref>:<옛 파일> <새 파일 또는 glob> [...]

예) python tests/tools/compare-functions.py HEAD:src/ui/chatList.js "src/ui/chatList/*.js"

옛 파일의 최상위 function 선언을 모두 뽑아, 새 파일들에 같은 이름·같은 본문으로
정확히 한 번씩 있는지 본다. (`export` 키워드 유무는 무시)
"""
import glob
import io
import re
import subprocess
import sys

NL = chr(10)
DECL = re.compile(r'^(export )?(async )?function (\w+)\s*\(', re.M)
# 함수 본문이 아닌, 다음 선언에 딸린 줄 (주석, 빈 줄, 모듈 변수, import/export 문)
TRAILER = re.compile(r'^(\s*$|/\*\*|\s\*|//|let |const |import |export \{|\} from )')


def read_git(spec):
    data = subprocess.run(['git', 'show', spec], capture_output=True, check=True).stdout
    return data.decode('utf-8-sig').replace(chr(13) + NL, NL)


def read_file(path):
    return io.open(path, encoding='utf-8-sig').read().replace(chr(13) + NL, NL)


def functions(src):
    """최상위 function 선언별 본문.

    선언 시작부터 다음 최상위 선언 직전까지를 자른 뒤, 끝에 붙은 "다음 선언의 주석/변수"
    줄을 떼어낸다. (닫는 중괄호 위치로 끝을 찾지 않는 이유: 이 코드에는 닫는 중괄호가
    들여쓰기된 최상위 함수가 있어서 0열 중괄호 규칙이 틀린다.)
    """
    out = {}
    counts = {}
    matches = list(DECL.finditer(src))
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(src)
        lines = src[m.start():end].split(NL)
        while lines and TRAILER.match(lines[-1]):
            lines.pop()
        text = re.sub(r'^export ', '', NL.join(lines))
        name = m.group(3)
        counts[name] = counts.get(name, 0) + 1
        out[name] = text
    return out, counts


def top_vars(src):
    return sorted(set(re.findall(r'^(?:let|const) (\w+)', src, re.M)))


def main():
    old_spec, new_patterns = sys.argv[1], sys.argv[2:]
    old = read_git(old_spec)
    new_files = sorted(f for p in new_patterns for f in glob.glob(p))
    new_sources = [read_file(f) for f in new_files]
    new = NL.join(new_sources)

    a, _ = functions(old)
    # 새 파일은 하나씩 따로 읽는다 (이어 붙이면 파일의 마지막 함수에 다음 파일의 머리말이 섞임)
    b, b_counts = {}, {}
    for source in new_sources:
        found, counts = functions(source)
        b.update(found)
        for name, count in counts.items():
            b_counts[name] = b_counts.get(name, 0) + count

    missing = [k for k in a if k not in b]
    extra = [k for k in b if k not in a]
    changed = [k for k in a if k in b and a[k] != b[k]]
    dupes = [k for k, v in b_counts.items() if v > 1]

    print(f'functions: old {len(a)} / new {len(b)} in {len(new_files)} files')
    print('missing :', missing)
    print('extra   :', extra)
    print('changed :', changed)
    print('dupes   :', dupes)
    print('top-level vars old:', top_vars(old))
    print('top-level vars new:', top_vars(new))
    ok = not (missing or extra or changed or dupes) and top_vars(old) == top_vars(new)
    print('RESULT:', 'IDENTICAL' if ok else 'DIFFERENT')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
