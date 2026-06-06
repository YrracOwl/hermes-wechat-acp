import { readFileSync } from 'fs';
import crypto from 'crypto';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;
const token = td.token;
const baseUrl = td.baseUrl || 'https://ilinkai.weixin.qq.com';

async function apiPost(endpoint, body) {
  const uin = String(Math.floor(Math.random() * 1e10));
  const resp = await fetch(`${baseUrl}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'AuthorizationType': 'ilink_bot_token',
      'Authorization': `Bearer ${token}`,
      'X-WECHAT-UIN': Buffer.from(uin).toString('base64'),
    },
    body: JSON.stringify({ base_info: { channel_version: '1.0.2' }, ...body }),
  });
  return resp.json();
}

// Test 1: plain text via manual fetch
console.log('Test 1: plain text...');
const r1 = await apiPost('ilink/bot/sendmessage', {
  msg: {
    from_user_id: '', to_user_id: uid,
    client_id: `txt-test-${crypto.randomUUID()}`,
    message_type: 2, message_state: 2,
    context_token: st.users[uid].contextToken,
    item_list: [{ type: 1, text_item: { text: '手动 fetch 文字测试' } }],
  },
});
console.log('Result:', JSON.stringify(r1));

// Test 2: image with short downloadParam (simulated)
console.log('\nTest 2: image with SHORT enc param...');
const r2 = await apiPost('ilink/bot/sendmessage', {
  msg: {
    from_user_id: '', to_user_id: uid,
    client_id: `img-test-${crypto.randomUUID()}`,
    message_type: 2, message_state: 2,
    context_token: st.users[uid].contextToken,
    item_list: [{
      type: 2,
      image_item: {
        media: { encrypt_query_param: 'abc123', aes_key: 'dGVzdDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MA==', encrypt_type: 1 },
        mid_size: 16,
      },
    }],
  },
});
console.log('Result:', JSON.stringify(r2));
