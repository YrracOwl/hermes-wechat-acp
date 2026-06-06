// Compare upload with and without iLink headers
import { readFileSync } from 'fs';
import crypto from 'crypto';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;
const token = td.token;
const baseUrl = td.baseUrl || 'https://ilinkai.weixin.qq.com';
const cdnBase = 'https://novac2c.cdn.weixin.qq.com/c2c';

const plaintext = readFileSync('/tmp/real_test.png');
const rawsize = plaintext.length;
const rawfilemd5 = crypto.createHash('md5').update(plaintext).digest('hex');
const filesize = Math.ceil((rawsize + 1) / 16) * 16;
const aeskey = crypto.randomBytes(16);

async function doUpload(withHeaders) {
  const filekey = crypto.randomBytes(16).toString('hex');
  const uin = String(Math.floor(Math.random() * 1e10));
  
  const headers = {
    'Content-Type': 'application/json',
    'AuthorizationType': 'ilink_bot_token',
    'Authorization': `Bearer ${token}`,
    'X-WECHAT-UIN': Buffer.from(uin).toString('base64'),
  };
  if (withHeaders) {
    headers['iLink-App-Id'] = 'bot';
    headers['iLink-App-ClientVersion'] = String(0x010002); // 1.0.2
  }

  const getUploadUrlBody = {
    filekey, media_type: 1, to_user_id: uid,
    rawsize, rawfilemd5, filesize, no_need_thumb: true,
    aeskey: aeskey.toString('hex'),
    base_info: { channel_version: '1.0.2' },
  };

  const r1 = await fetch(`${baseUrl}/ilink/bot/getuploadurl`, {
    method: 'POST', headers, body: JSON.stringify(getUploadUrlBody),
  });
  const resp = await r1.json();
  if (!resp.upload_param) throw new Error('No upload_param');

  // CDN upload (no special headers)
  const cipher = crypto.createCipheriv('aes-128-ecb', aeskey, null);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const cdnUrl = `${cdnBase}/upload?encrypted_query_param=${encodeURIComponent(resp.upload_param)}&filekey=${encodeURIComponent(filekey)}`;
  const r2 = await fetch(cdnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(ciphertext),
  });
  const dp = r2.headers.get('x-encrypted-param');
  return dp;
}

const dpWith = await doUpload(true);
const dpWithout = await doUpload(false);

console.log('With headers:    ' + dpWith.substring(0, 60) + '...');
console.log('Without headers: ' + dpWithout.substring(0, 60) + '...');
console.log('Length with: ' + dpWith.length + ', without: ' + dpWithout.length);
console.log('URL-safe chars with: ' + /^[A-Za-z0-9\-_=]+$/.test(dpWith));
console.log('URL-safe chars without: ' + /^[A-Za-z0-9\-_=]+$/.test(dpWithout));
