# 세션 ("봇 안 봇") 구조 명세

이 문서가 세션 기능의 기준이다. 구현이 이 문서와 다르면 문서를 먼저 고치고 구현한다.

## 1. 목표

한 봇에 채팅이 50개씩 쌓이면 목록이 한 줄로 길게 늘어져 보기 힘들다.
봇에 들어가면 먼저 **세션 카드**(대체 이미지가 붙은 "봇 안의 봇")가 보이고,
세션에 들어가면 그 세션의 채팅만 보이게 한다.

- 세션은 채팅 파일을 **복사하지 않는다.** 파일 이름만 참조한다.
- 한 채팅이 **여러 세션에 동시에** 들어갈 수 있다.
  예) 채팅 1~5는 "AU", 1~3은 "분기", 5~6은 "같은 페르소나".
- 봇 카드(캐릭터 파일)와 채팅 파일은 건드리지 않는다. 세션은 로비 안에서만 존재한다.

## 2. 하지 않는 것 (v1)

- 그룹 채팅의 세션 (캐릭터만)
- 세션을 캐릭터 그리드에 별도 카드로 꺼내기
- 채팅 목록 안의 구분선(소제목)
- 실제 봇 복사
- 폴더 기능 제거: **폴더 데이터와 "보관함" 탭은 그대로 둔다** (5절 참고)

## 3. 데이터

저장 위치는 IndexedDB (`src/data/persist.js`). localStorage에 넣지 않는다.

### 3.1 `chatLobby_sessions`

```js
{
  version: 1,
  migratedFromFolders: false,          // 폴더 → 세션 변환을 이미 했는지
  characters: {
    "<avatar>": {
      sessions: [
        {
          id: "s_<영숫자>",            // 고유 ID
          name: "AU",
          chats: ["파일명", ...],       // .jsonl 없는 파일명. 넣은 순서 유지, 중복 없음
          createdAt: 1731600000000,
          updatedAt: 1731600000000,
        },
      ],
      memos: { "<파일명>": "메모 내용" } // 채팅 메모 (세션과 무관, 채팅 단위)
    }
  }
}
```

### 3.2 `chatLobby_sessionImages`

```js
{ "<sessionId>": "data:image/jpeg;base64,..." }
```

이미지는 본 데이터와 따로 둔다. 세션을 조금 바꿀 때마다 이미지까지 다시 쓰지 않기 위해서다.
이미지는 저장 전에 긴 변 384px 이하로 줄인다 (canvas, JPEG 품질 0.85).

### 3.3 규칙

- 파일명은 항상 `.jsonl`을 뗀 형태로 저장하고 비교한다. 모든 공개 함수는 입력에서 `.jsonl`을 떼어낸다.
- 세션에 없는 채팅 = "미분류". 따로 저장하지 않고 계산한다.
- **자동 정리 금지**: "채팅 목록에 없는 파일명"을 세션에서 스스로 지우지 않는다.
  채팅 목록 요청이 실패해 빈 배열이 돌아오면 세션이 통째로 비워지는 사고가 나기 때문이다.
  없는 파일명은 그릴 때만 걸러내고, 삭제/이름 변경은 6절의 훅으로만 반영한다.
- 빈 캐릭터 항목(세션 0개, 메모 0개)은 저장에서 제거한다.

## 4. 저장소 API (`src/data/sessionStore.js`)

값을 모듈 변수에 들고 있지 말고 매번 `persistGet`으로 읽는다 (`persist.js` 머리말 참고).
모든 변경 함수는 `persistSet`으로 저장한다. 모두 동기 함수다.

```js
export const SESSIONS_KEY = 'chatLobby_sessions';
export const SESSION_IMAGES_KEY = 'chatLobby_sessionImages';
export const SESSION_ALL = 'all';            // 가상 세션: 전체 채팅
export const SESSION_UNSORTED = 'unsorted';  // 가상 세션: 어느 세션에도 없는 채팅

// 읽기
getSessions(avatar)                        // → Session[] (저장 순서)
getSession(avatar, sessionId)              // → Session | null
hasSessions(avatar)                        // → boolean
getChatSessions(avatar, fileName)          // → Session[] (이 채팅이 들어 있는 세션들)
getSessionChatSet(avatar, sessionId)       // → Set<string>
getAssignedChatSet(avatar)                 // → Set<string> (어느 세션에든 들어 있는 채팅)
filterChatsBySession(avatar, sessionId, chats)
    // chats: [{ file_name }...] → 해당 세션의 채팅만.
    // SESSION_ALL은 그대로, SESSION_UNSORTED는 어느 세션에도 없는 것만.
getSessionImage(sessionId)                 // → dataURL | null
getMemo(avatar, fileName)                  // → string ('' = 없음)

// 세션 관리
createSession(avatar, name, { chats = [] } = {})   // → Session. 이름은 trim, 빈 이름은 '새 세션'
renameSession(avatar, sessionId, name)             // → boolean
deleteSession(avatar, sessionId)                   // → boolean. 채팅은 지우지 않음. 이미지도 같이 제거
reorderSessions(avatar, sessionIds)                // → void. 목록에 없는 ID는 뒤에 유지
setSessionImage(sessionId, dataUrl)                // dataUrl이 null이면 제거

// 소속 변경
addChats(avatar, sessionId, fileNames)             // → 추가된 수
removeChats(avatar, sessionId, fileNames)          // → 제거된 수
setChatMembership(avatar, fileNames, { add = [], remove = [] })
    // 여러 채팅을 여러 세션에 한 번에 넣고 빼기 (세션 선택 창의 "적용")

// 메모
setMemo(avatar, fileName, text)                    // 빈 문자열이면 삭제. 최대 2000자로 자름

// 채팅/캐릭터 변화 반영 (6절)
renameChat(avatar, oldFileName, newFileName)       // 세션 소속과 메모를 새 이름으로 이동
removeChat(avatar, fileName)                       // 모든 세션과 메모에서 제거
removeCharacter(avatar)                            // 그 봇의 세션·메모·이미지 전부 제거

// 마이그레이션 (5절)
migrateFoldersToSessions(lobbyData)                // → { created: number, skipped: boolean }
```

## 5. 폴더 → 세션 마이그레이션

기존 폴더(`chatLobby_data`의 `folders`, `chatAssignments`)는 봇을 가로지르는 묶음이고
"보관함" 탭이 쓰고 있다. **지우거나 바꾸지 않는다.** 읽기만 한다.

`migrateFoldersToSessions(lobbyData)`:

1. `migratedFromFolders`가 이미 true면 `{ created: 0, skipped: true }`.
2. `chatAssignments`의 키는 `"<avatar>::<파일명>"`, 값은 폴더 ID.
   폴더 ID가 `favorites`, `uncategorized`이거나 `folders`에 없는 ID면 건너뛴다.
   키가 `group_`으로 시작하면(그룹 채팅) 건너뛴다.
3. (봇, 폴더) 조합마다 그 폴더 이름으로 세션을 만들고 해당 채팅을 넣는다.
   같은 봇에 같은 이름의 세션이 이미 있으면 새로 만들지 않고 거기에 합친다.
4. 끝나면 `migratedFromFolders = true`를 저장한다. 폴더가 하나도 없어도 true로 저장한다.
5. `lobbyData`는 수정하지 않는다.

여러 번 불러도 결과가 같아야 한다. 호출 시점은 `initPersist` 직후 1회.

## 6. 채팅·캐릭터 변화 반영

| 일어난 일 | 호출 |
|---|---|
| 로비에서 채팅 이름 변경 | `renameChat` |
| 로비에서 채팅 삭제 / 일괄 삭제 | `removeChat` |
| ST `CHAT_RENAMED` 이벤트 (`{ avatarId, oldFileName, newFileName }`, `.jsonl` 포함일 수 있음) | `renameChat` |
| ST `CHAT_DELETED` 이벤트 (파일명만 옴) | 현재 열린 캐릭터 기준으로 `removeChat` |
| ST `CHARACTER_DELETED` 이벤트 | `removeCharacter` |
| 세션 안에서 새 채팅 시작 | 새 채팅 파일명을 그 세션에 `addChats` |

기존 훅 위치: `chatList`의 이름 변경/일괄 삭제, `chatHandlers.deleteChat`,
`index.js`의 `onCharacterDeleted`. 폴더·리마인드·형광펜이 이미 같은 자리에서 정리된다.

새 채팅: 다른 봇이면 `chatHandlers.startNewCharacterChat`이 파일명을 직접 만든다 → 바로 추가.
같은 봇이면 ST 버튼이 만들어서 이름을 모른다 → "다음에 이 봇에서 생기는 새 채팅을 이 세션에 넣기"를
기억해 두었다가 `CHAT_CHANGED`에서 처리한다 (60초 안, 그 봇일 때만).

## 7. 화면

채팅 패널(`#chat-lobby-chats`)의 목록 영역이 세 가지 상태를 가진다.

### 7.1 세션 카드 (봇에 세션이 1개 이상일 때 처음 보이는 화면)

```
[ 전체 채팅 49 ]  [ AU 7 ]  [ 분기 12 ]  [ 같은 페르소나 5 ]  [ 미분류 30 ]  [ + 새 세션 ]
```

- 카드: 이미지(세션 이미지, 없으면 봇 이미지), 이름, 채팅 수, 마지막 채팅 시각.
- "전체 채팅" 카드는 항상 첫 번째. "미분류"는 미분류가 1개 이상이고 전체보다 적을 때만.
- 카드를 누르면 7.2로. 카드의 ⋮: 이름 바꾸기, 이미지 바꾸기, 봇 이미지로 되돌리기, 세션 삭제.
- 세션 삭제는 확인을 받고, "채팅은 지워지지 않습니다"를 밝힌다.

세션이 없는 봇은 이 화면 없이 바로 7.2(전체)로 간다. 지금과 같은 모습이다.

### 7.2 채팅 목록

목록 위에 한 줄:

```
← 세션 목록   [이미지] AU · 7개            [+ 채팅 담기]  [⋮]
```

- 세션이 없는 봇에서는 이 줄 대신 필터 줄에 `🗂️ 세션` 버튼 하나만 둔다 (누르면 새 세션 만들기).
- 목록은 기존 렌더러를 그대로 쓰고, 세션 소속으로 먼저 거른 뒤 기존 필터(즐겨찾기/폴더)와 정렬을 적용한다.
- "전체 채팅"에서는 각 채팅에 소속 세션 이름을 작은 칩으로 보여준다.
- 메모가 있으면 미리보기 아래 한 줄로 보여준다 (`📝 ...`).
- 헤더의 채팅 수는 지금 보이는 목록 기준.
- `← 세션 목록`은 7.1로. 패널의 기존 뒤로 버튼(패널 닫기)은 그대로.

### 7.3 세션에 담기 (정리 도구)

1. **세션 선택 창**: 세션마다 체크박스(일부만 들어 있으면 중간 상태), 맨 아래 `+ 새 세션` 입력.
   "적용"을 누르면 `setChatMembership` 한 번으로 반영.
   여는 곳: 채팅 ⋮ 메뉴 `🗂️ 세션 지정`, 일괄 선택 툴바 `🗂️ 세션`.
2. **채팅 담기 창** (세션 안의 `+ 채팅 담기`): 그 봇의 모든 채팅을 체크박스 목록으로.
   이미 들어 있는 채팅은 체크된 상태. 이름/메모 검색. "저장"하면 추가·제거를 한 번에 반영.
3. 채팅 ⋮ 메뉴 추가 항목:
   - `🗂️ 세션 지정`
   - `🌳 같은 분기 전체 선택` → 일괄 선택 모드로 들어가며 같은 분기의 채팅을 모두 선택
     (분기 정보는 `branchCache.getAllBranches`. 분석된 적 없으면 "분기 정렬에서 먼저 분석하세요" 안내)
   - `📝 메모`
   - 세션 안에서 볼 때만: `➖ 이 세션에서 빼기`
4. 기존 메뉴의 "폴더 이동" 항목은 제목만 "보관함 폴더"로 바꾸고 동작은 그대로 둔다.

같은 분기 = 부모 관계(`parentChat`)로 이어진 채팅 전체 (뿌리와 모든 후손).

### 7.4 이미지 바꾸기

파일 선택 → canvas로 줄이기(3.2) → `setSessionImage`. 실패하면 토스트만 띄우고 기존 이미지 유지.

## 8. 안전 규칙

- 채팅 파일, 캐릭터 파일, 폴더 데이터를 이 기능이 수정하는 일은 없다.
- 세션 데이터가 깨져 있으면(형식 불일치) 그 봇의 세션만 빈 것으로 취급하고 계속 동작한다. 예외를 밖으로 던지지 않는다.
- 사용자 입력(세션 이름, 메모)은 화면에 넣을 때 반드시 `escapeHtml`.
- 세션 화면이 실패해도 채팅 목록은 떠야 한다. 세션 관련 호출은 실패 시 "전체 채팅" 목록으로 떨어진다.
- 초기화 순서: `initPersist` → `migrateFoldersToSessions` → 로비 열기. `index.js`의 `runStep`으로 격리.

## 9. 검증

- `tests/sessionStore.test.mjs` (`npm test`에 포함): 4절의 모든 함수, 다중 소속, 이름 변경/삭제 반영,
  마이그레이션(중복 호출, 시스템 폴더/그룹 제외, 같은 이름 합치기, `lobbyData` 불변), 깨진 데이터.
- 가짜 ST 환경(`npm run build && npm run harness`)에서: 세션 없는 봇은 예전과 같은 목록,
  세션 만든 뒤 카드 화면, 한 채팅을 두 세션에 담기, 세션 안에서 새 채팅 → 자동 소속,
  채팅 이름 변경/삭제 후 세션 반영.
