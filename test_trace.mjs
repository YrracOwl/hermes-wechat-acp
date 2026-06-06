// Full trace from within wechat-acp directory
import { readFileSync } from 'fs';
import crypto from 'crypto';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;
const opts = { baseUrl: td.baseUrl || 'https://ilinkai.weixin.qq.com', token: td.token };
const cdnBase = 'https://novac2c.cdn.weixin.qq.com/c2c';
const log = (m) => console.log('[LOG] ' + m);

// Import our patched modules 
const uploadMod = await import('./dist/src/weixin/upload.js');
const sendMod = await import('./dist/src/weixin/send.js');
const apiMod = await import('./dist/src/weixin/api.js');

const filePath = '/tmp/test_image.png';
console.log('=== UPLOAD ===');
const uploaded = await uploadMod.uploadImageToWeixin({
  filePath, toUserId: uid, opts, cdnBaseUrl: cdnBase, log
});
console.log('aeskey:', uploaded.aeskey);
console.log('fileSize:', uploaded.fileSize);
console.log('downloadParam:', uploaded.downloadEncryptedQueryParam.substring(0, 60) + '...');

// Check aes_key encoding
const aesKeyB64 = Buffer.from(uploaded.aeskey).toString('base64');
console.log('aes_key (official encoding):', aesKeyB64, '(' + aesKeyB64.length + ' chars)');

// Verify by decoding
const decoded = Buffer.from(aesKeyB64, 'base64');
console.log('decoded length:', decoded.length);
console.log('decoded as ascii:', decoded.toString('ascii'));

console.log('\n=== SEND ===');
const sendOpts = { ...opts, contextToken: st.users[uid].contextToken };
const result = await sendMod.sendImageMessage({
  to: uid,
  text: 'Full trace test',
  uploaded,
  opts: sendOpts,
  sendFn: async function(params) {
    console.log('FINAL PAYLOAD to iLink:');
    console.log(JSON.stringify(params.body, null, 2));
    return apiMod.sendMessage(params);
  }
});
console.log('Result:', JSON.stringify(result));
