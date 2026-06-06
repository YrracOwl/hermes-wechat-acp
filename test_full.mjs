import { readFileSync } from 'fs';
import crypto from 'crypto';
import { writeFileSync } from 'fs';

const origFetch = globalThis.fetch;
globalThis.fetch = async function(url, init) {
  const result = await origFetch(url, init);
  if (String(url).includes('sendmessage')) {
    writeFileSync('/tmp/last_payload.txt', String(init?.body || ''));
  }
  return result;
};

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;

const { sendMessage } = await import('./dist/src/weixin/api.js');

await sendMessage({
  baseUrl: td.baseUrl || 'https://ilinkai.weixin.qq.com',
  token: td.token,
  body: {
    msg: {
      from_user_id: '', to_user_id: uid,
      client_id: `wechat-acp-${crypto.randomUUID()}`,
      message_type: 2, message_state: 2,
      context_token: st.users[uid].contextToken,
      item_list: [{ type: 1, text_item: { text: 'full body test' } }],
    },
  },
});

console.log('=== FULL PAYLOAD ===');
console.log(readFileSync('/tmp/last_payload.txt', 'utf-8'));
