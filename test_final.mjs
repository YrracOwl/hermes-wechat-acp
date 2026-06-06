// Direct send via wechat_send.py's approach but WITH response checking
import { readFileSync } from 'fs';
import crypto from 'crypto';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;

// Intercept fetch to check ALL JSON responses for ret:-2
const origFetch = globalThis.fetch;
globalThis.fetch = async function(url, init) {
  const result = await origFetch(url, init);
  const urlStr = String(url);
  if (urlStr.includes('sendmessage') || urlStr.includes('getuploadurl')) {
    const clone = result.clone();
    const text = await clone.text();
    const short = text.substring(0, 100);
    if (text.includes('ret') && text.includes('-2')) {
      console.log(`RET=-2 from ${urlStr.split('/').pop()}: ${short}`);
    }
  }
  return result;
};

const uploadMod = await import('./dist/src/weixin/upload.js');
const sendMod = await import('./dist/src/weixin/send.js');

const opts = { baseUrl: td.baseUrl || 'https://ilinkai.weixin.qq.com', token: td.token };
const cdnBase = 'https://novac2c.cdn.weixin.qq.com/c2c';
const log = () => {};

// Send image
console.log('=== IMAGE ===');
const upImg = await uploadMod.uploadImageToWeixin({
  filePath: '/tmp/big_test.png', toUserId: uid, opts, cdnBaseUrl: cdnBase, log
});
const rImg = await sendMod.sendImageMessage({
  to: uid, text: 'final image test', uploaded: upImg,
  opts: { ...opts, contextToken: st.users[uid].contextToken }
});
console.log('Result:', rImg.messageId);

// Send file
console.log('=== FILE ===');
const upFile = await uploadMod.uploadFileAttachmentToWeixin({
  filePath: '/tmp/test.pdf', toUserId: uid, opts, cdnBaseUrl: cdnBase, log
});
const rFile = await sendMod.sendFileMessage({
  to: uid, text: 'final file test', fileName: 'test.pdf', uploaded: upFile,
  opts: { ...opts, contextToken: st.users[uid].contextToken }
});
console.log('Result:', rFile.messageId);
