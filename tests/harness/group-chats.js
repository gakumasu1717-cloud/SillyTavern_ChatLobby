// 가짜 ST group-chats 모듈 (확장의 '../../../../group-chats.js' import가 여기로 옴)
export async function openGroupById(groupId) {
  const st = window.__st;
  if (st.refuseNext) { st.refuseNext = false; st.log.push('openGroupById refused'); return false; }
  if (st.state.groupId === groupId) return false;
  st.state.groupId = groupId; st.state.chid = undefined;
  await st.loadGroupChat(groupId);
  return true;
}
