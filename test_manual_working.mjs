// EXACT replica of the working manual test
import { readFileSync } from 'fs';
import crypto from 'crypto';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;
const token = td.token;
const baseUrl = td.baseUrl || 'https://ilinkai.weixin.qq.com';
const cdnBase = 'https://novac2c.cdn.weixin.qq.com/c2c';

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

// Use test_image.png (236 bytes)
const plaintext = readFileSync('/tmp/test_image.png');
const rawsize = plaintext.length;
const rawfilemd5 = crypto.createHash('md5').update(plaintext).digest('hex');
const filesize = Math.ceil((rawsize + 1) / 16) * 16;
const filekey = crypto.randomBytes(16).toString('hex');
const aeskey = crypto.randomBytes(16);
const aeskeyHex = aeskey.toString('hex');

console.log('File:', rawsize, 'bytes');

// Upload
const uploadResp = await apiPost('ilink/bot/getuploadurl', {
  filekey, media_type: 1, to_user_id: uid,
  rawsize, rawfilemd5, filesize, no_need_thumb: true, aeskey: aeskeyHex,
});
const uploadParam = uploadResp.upload_param;
console.log('upload_param:', !!uploadParam);

// CDN
const cipher = crypto.createCipheriv('aes-128-ecb', aeskey, null);
const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const cdnUrl = `${cdnBase}/upload?encrypted_query_param=${encodeURIComponent(uploadParam)}&filekey=${encodeURIComponent(filekey)}`;
const cdnResp = await fetch(cdnUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/octet-stream' },
  body: new Uint8Array(ciphertext),
});
const downloadParam = cdnResp.headers.get('x-encrypted-param');
console.log('CDN:', cdnResp.status, 'dp len:', downloadParam.length);

// OFFICIAL encoding (confirmed working by user)
const aesKeyB64 = Buffer.from(aeskeyHex).toString('base64');
console.log('aes_key:', aesKeyB64, '(' + aesKeyB64.length + ' chars)');

// Send
const result = await apiPost('ilink/bot/sendmessage', {
  msg: {
    from_user_id: '', to_user_id: uid,
    client_id: `manual-${crypto.randomUUID()}`,
    message_type: 2, message_state: 2,
    context_token: st.users[uid].contextToken,
    item_list: [{
      type: 2,
      image_item: {
        media: { encrypt_query_param: downloadParam, aes_key: aesKeyB64, encrypt_type: 1 },
        mid_size: filesize,
      },
    }],
  },
});
console.log('Send result:', JSON.stringify(result));
console.log('Done - this is the EXACT same code that worked before. Check WeChat!');
