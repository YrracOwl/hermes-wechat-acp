import { readFileSync } from 'fs';
import crypto from 'crypto';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;
const token = td.token;
const baseUrl = td.baseUrl || 'https://ilinkai.weixin.qq.com';

console.log('token length:', token.length);
console.log('token prefix:', token.substring(0, 20));

const uin = String(Math.floor(Math.random() * 1e10));
const uinB64 = Buffer.from(uin).toString('base64');

const body = {
  msg: {
    from_user_id: '', to_user_id: uid,
    client_id: `dbg-${crypto.randomUUID()}`,
    message_type: 2, message_state: 2,
    context_token: st.users[uid].contextToken,
    item_list: [{ type: 1, text_item: { text: 'debug2' } }],
  },
  base_info: { channel_version: '1.0.2' },
};

const bodyStr = JSON.stringify(body);
console.log('body length:', bodyStr.length);

const url = `${baseUrl}/ilink/bot/sendmessage`;
const headers = {
  'Content-Type': 'application/json',
  'AuthorizationType': 'ilink_bot_token',
  'Authorization': `Bearer ${token}`,
  'X-WECHAT-UIN': uinB64,
  'iLink-App-Id': 'bot',
  'iLink-App-ClientVersion': '65538',
};

console.log('URL:', url);
console.log('Headers:', JSON.stringify(headers, null, 2).replace(token, 'TOKEN_REDACTED'));

const resp = await fetch(url, { method: 'POST', headers, body: bodyStr });
const text = await resp.text();
console.log('Status:', resp.status);
console.log('Response:', text);

// Also try with the EXACT same fetch that our apiPost uses, including AbortController
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 15000);
const resp2 = await fetch(url, {
  method: 'POST',
  headers,
  body: bodyStr,
  signal: controller.signal,
});
clearTimeout(timer);
console.log('\nWith AbortController: Status:', resp2.status, 'Body:', await resp2.text());
