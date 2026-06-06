// Exact replica of what wechat_send.py generates for text messages
import { readFileSync } from 'fs';
import crypto from 'crypto';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = "o9cq804ElOtQpY2jrM6JROSBF22Q@im.wechat";
const text = "py-replica test";

// Use the SAME api.ts module that wechat_send.py uses
const { sendMessage } = await import('./dist/src/weixin/api.js');

// Call EXACTLY like sendTextMessage does
const id = `wechat-acp-${crypto.randomUUID()}`;
try {
  await sendMessage({
    baseUrl: td.baseUrl || 'https://ilinkai.weixin.qq.com',
    token: td.token,
    body: {
      msg: {
        from_user_id: '',
        to_user_id: uid,
        client_id: id,
        message_type: 2,
        message_state: 2,
        context_token: st.users[uid].contextToken,
        item_list: [{ type: 1, text_item: { text } }],
      },
    },
  });
  console.log('SUCCESS');
} catch(e) {
  console.log('FAIL:', e.message);
}
