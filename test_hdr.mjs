import { readFileSync } from 'fs';
import crypto from 'crypto';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;
const token = td.token;
const baseUrl = td.baseUrl || 'https://ilinkai.weixin.qq.com';

const msgBody = {
  msg: {
    from_user_id: '', to_user_id: uid,
    client_id: `hdr-test-${crypto.randomUUID()}`,
    message_type: 2, message_state: 2,
    context_token: st.users[uid].contextToken,
    item_list: [{ type: 1, text_item: { text: 'header test' } }],
  },
  base_info: { channel_version: '1.0.2' },
};

// Test 1: WITHOUT iLink headers (old way)
const r1 = await fetch(`${baseUrl}/ilink/bot/sendmessage`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'AuthorizationType': 'ilink_bot_token',
    'Authorization': `Bearer ${token}`,
    'X-WECHAT-UIN': Buffer.from(String(Math.floor(Math.random()*1e10))).toString('base64'),
  },
  body: JSON.stringify(msgBody),
});
console.log('WITHOUT iLink headers:', await r1.json());

// Test 2: WITH iLink headers (new way)
const r2 = await fetch(`${baseUrl}/ilink/bot/sendmessage`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'AuthorizationType': 'ilink_bot_token',
    'Authorization': `Bearer ${token}`,
    'X-WECHAT-UIN': Buffer.from(String(Math.floor(Math.random()*1e10))).toString('base64'),
    'iLink-App-Id': 'bot',
    'iLink-App-ClientVersion': '65538',
  },
  body: JSON.stringify(msgBody),
});
console.log('WITH iLink headers:', await r2.json());
