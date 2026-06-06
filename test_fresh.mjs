import { readFileSync } from 'fs';
import crypto from 'crypto';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;
const token = td.token;
const baseUrl = td.baseUrl || 'https://ilinkai.weixin.qq.com';

// Verify contextToken is fresh
console.log('contextToken:', st.users[uid].contextToken.substring(0, 30) + '...');

// Quick text test
const uin = String(Math.floor(Math.random() * 1e10));
const resp = await fetch(`${baseUrl}/ilink/bot/sendmessage`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'AuthorizationType': 'ilink_bot_token',
    'Authorization': `Bearer ${token}`,
    'X-WECHAT-UIN': Buffer.from(uin).toString('base64'),
  },
  body: JSON.stringify({
    msg: {
      from_user_id: '', to_user_id: uid,
      client_id: `verify-${crypto.randomUUID()}`,
      message_type: 2, message_state: 2,
      context_token: st.users[uid].contextToken,
      item_list: [{ type: 1, text_item: { text: 'fresh ctx verify' } }],
    },
    base_info: { channel_version: '1.0.2' },
  }),
});
console.log('API response:', await resp.json());
