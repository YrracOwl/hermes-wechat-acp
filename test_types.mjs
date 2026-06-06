// Compare image vs file send with same contextToken
import { readFileSync } from 'fs';
import crypto from 'crypto';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;
const token = td.token;
const baseUrl = td.baseUrl || 'https://ilinkai.weixin.qq.com';

async function testSend(itemType, itemBody) {
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
        client_id: `test-${crypto.randomUUID()}`,
        message_type: 2, message_state: 2,
        context_token: st.users[uid].contextToken,
        item_list: [{ type: itemType, ...itemBody }],
      },
      base_info: { channel_version: '1.0.2' },
    }),
  });
  return resp.json();
}

// Test 1: IMAGE (type 2) with fake CDN data
const r1 = await testSend(2, {
  image_item: {
    media: { encrypt_query_param: 'abc', aes_key: 'dGVzdA==', encrypt_type: 1 },
    mid_size: 16,
  }
});
console.log('IMAGE:', JSON.stringify(r1));

// Test 2: FILE (type 4) with fake CDN data  
const r2 = await testSend(4, {
  file_item: {
    media: { encrypt_query_param: 'abc', aes_key: 'dGVzdA==', encrypt_type: 1 },
    file_name: 'test.txt',
    len: '100',
  }
});
console.log('FILE:', JSON.stringify(r2));

// Test 3: FILE with md5
const r3 = await testSend(4, {
  file_item: {
    media: { encrypt_query_param: 'abc', aes_key: 'dGVzdA==', encrypt_type: 1 },
    file_name: 'test.txt',
    len: '100',
    md5: 'abc123',
  }
});
console.log('FILE+md5:', JSON.stringify(r3));

// Test 4: TEXT (type 1) as control
const r4 = await testSend(1, {
  text_item: { text: 'control' }
});
console.log('TEXT:', JSON.stringify(r4));
