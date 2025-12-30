# 🎬 Chat Lobby - SillyTavern Extension

**Netflix Style UI**로 리디자인된 캐릭터 기반 채팅방 선택 UI를 제공하는 SillyTavern 확장 프로그램입니다.

## ✨ 새로운 기능 (Netflix Redesign)

- 🎨 **넷플릭스 스타일 UI**: 다크 테마 + Pretendard 폰트
- 🖼️ **호버 확대 카드**: 마우스 오버 시 카드가 확대되며 상세정보 표시
- 📊 **Chat Wrapped**: 대화 통계 및 퀴즈 기능 강화
- 🎯 **Fun Facts**: 재미있는 통계 정보 제공
- ⭐ **즐겨찾기**: 캐릭터/채팅 즐겨찾기 기능

## 기본 기능

- 🖼️ **캐릭터 그리드 뷰**: 모든 캐릭터를 카드 형태로 표시
- 💬 **채팅 목록**: 캐릭터 클릭 시 해당 캐릭터와의 모든 채팅 기록 표시
- 🔍 **검색 기능**: 캐릭터 이름으로 빠르게 검색
- 🏷️ **태그 필터**: 태그로 캐릭터 필터링
- 📁 **폴더 관리**: 채팅을 폴더로 분류
- ➕ **새 채팅**: 선택한 캐릭터와 바로 새 채팅 시작
- 👤 **페르소나 선택**: 빠른 페르소나 전환

## 설치 방법

1. SillyTavern의 `public/scripts/extensions/third-party/` 폴더로 이동
2. 이 폴더를 복사 (또는 `SillyTavern-ChatLobby` 이름으로 클론)
3. SillyTavern 재시작

## 사용 방법

1. 화면 우측 하단의 💬 FAB 버튼 클릭 (또는 옵션 메뉴에서 Chat Lobby)
2. 캐릭터 카드 호버 → 상세정보 및 버튼 표시
3. 캐릭터 클릭 → 오른쪽에 채팅 목록 슬라이드
4. 📊 Wrapped 버튼 → 대화 통계 및 퀴즈
5. `ESC` 키 또는 X 버튼으로 닫기

## 파일 구조

```
SillyTavern-ChatLobby/
├── manifest.json          # 확장 정보
├── package.json           # 패키지 정보
├── dist/
│   └── style.css          # Netflix 스타일 CSS
├── src/
│   ├── index.js           # 메인 진입점
│   ├── config.js          # 설정
│   ├── api/               # SillyTavern API
│   ├── data/              # 데이터 관리
│   ├── handlers/          # 이벤트 핸들러
│   ├── ui/                # UI 컴포넌트
│   └── utils/             # 유틸리티
└── README.md
```

## 디자인 컨셉

- **컬러**: Netflix 다크 테마 (#141414 배경, #E50914 액센트)
- **폰트**: Pretendard
- **카드**: 호버 시 1.3x 확대 + 그라데이션 오버레이
- **패널**: 오른쪽에서 슬라이드 인

## 요구 사항

- SillyTavern 1.12.0 이상

## 라이선스

MIT License
