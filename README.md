# Chat Lobby - SillyTavern Extension

캐릭터 기반 채팅방 선택 UI를 제공하는 SillyTavern 확장 프로그램입니다.

## 기능

- 🖼️ **캐릭터 그리드 뷰**: 모든 캐릭터를 카드 형태로 표시
- 💬 **채팅 목록**: 캐릭터 클릭 시 해당 캐릭터와의 모든 채팅 기록 표시
- 🔍 **검색 기능**: 캐릭터 이름으로 빠르게 검색
- ➕ **새 채팅**: 선택한 캐릭터와 바로 새 채팅 시작
- 🎨 **테마 호환**: SillyTavern 테마에 맞는 UI

## 설치 방법

1. SillyTavern의 `public/scripts/extensions/third-party/` 폴더로 이동
2. 이 폴더를 복사
3. SillyTavern 재시작

## 사용 방법

1. SillyTavern 상단 바에서 💬 아이콘 클릭
2. 캐릭터 카드 클릭 → 오른쪽에 채팅 목록 표시
3. 원하는 채팅 클릭 → 해당 채팅으로 이동
4. `ESC` 키 또는 배경 클릭으로 닫기

## 파일 구조

```
새 폴더 (3)/
├── manifest.json      # 확장 정보
├── dist/
│   ├── index.js       # 메인 스크립트
│   └── style.css      # 스타일
└── README.md
```

## 요구 사항

- SillyTavern 1.12.0 이상

## 라이선스

MIT License
