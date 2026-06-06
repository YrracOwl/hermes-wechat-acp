import { readFileSync, writeFileSync } from 'fs';
import crypto from 'crypto';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;
const token = td.token;
const baseUrl = td.baseUrl || 'https://ilinkai.weixin.qq.com';

// Direct fetch with full response
const uin = String(Math.floor(Math.random() * 1e10));
const body = {
  msg: {
    from_user_id: '', to_user_id: uid,
    client_id: `vfy-${crypto.randomUUID()}`,
    message_type: 2, message_state: 2,
    context_token: st.users[uid].contextToken,
    item_list: [{ type: 1, text_item: { text: 'verify' } }],
  },
  base_info: { channel_version: '1.0.2' },
};

const bodyStr = JSON.stringify(body);

const resp = await fetch(`${baseUrl}/ilink/bot/sendmessage`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'AuthorizationType': 'ilink_bot_token',
    'Authorization': `Bearer ${token}`,
    'X-WECHAT-UIN': Buffer.from(uin).toString('base64'),
    'iLink-App-Id': 'bot',
    'iLink-App-ClientVersion': '65538',
  },
  body: bodyStr,
});

const respText = await resp.text();
console.log('Status:', resp.status);
console.log('Response:', respText);

// Check: does the response have a JSON body or is it empty?
try {
  const json = JSON.parse(respText);
  console.log('Parsed:', JSON.stringify(json));
} catch(e) {
  console.log('Not JSON');
}
