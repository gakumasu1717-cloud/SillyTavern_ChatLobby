// 가짜 ST script.js (확장의 '../../../../../script.js' import가 여기로 옴)
export async function deleteCharacter(keys, { deleteChats = true } = {}) {
  const st = window.__st;
  if (!Array.isArray(keys)) keys = [keys];
  st.log.push('native deleteCharacter x' + keys.length + ' deleteChats=' + deleteChats);
  st.state.chid = undefined; st.state.groupId = null; // closeCurrentChat
  for (const key of keys) {
    const i = st.characters.findIndex(c => c.avatar === key);
    if (i === -1) continue;
    const [character] = st.characters.splice(i, 1);
    await st.eventSource.emit(st.eventTypes.CHARACTER_DELETED, { id: i, character });
  }
  return true;
}
