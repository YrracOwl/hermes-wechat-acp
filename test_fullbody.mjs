import { readFileSync } from 'fs';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;
const opts = { baseUrl: td.baseUrl || 'https://ilinkai.weixin.qq.com', token: td.token };
const cdnBase = 'https://novac2c.cdn.weixin.qq.com/c2c';

const origFetch = globalThis.fetch;
globalThis.fetch = async function(url, init) {
  const result = await origFetch(url, init);
  if (typeof url === 'string' && url.includes('sendmessage') && init?.body) {
    console.log('=== FULL sendmessage BODY ===');
    console.log(init.body);
    console.log('=== END BODY ===');
  }
  return result;
};

const uploadMod = await import('./dist/src/weixin/upload.js');
const sendMod = await import('./dist/src/weixin/send.js');

const log = (m) => {};
const filePath = '/tmp/test_image.png';

const uploaded = await uploadMod.uploadImageToWeixin({
  filePath, toUserId: uid, opts, cdnBaseUrl: cdnBase, log
});

console.log('uploaded.aeskey:', uploaded.aeskey);
console.log('uploaded.fileSizeCiphertext:', uploaded.fileSizeCiphertext);

const sendOpts = { ...opts, contextToken: st.users[uid].contextToken };
const result = await sendMod.sendImageMessage({
  to: uid, text: '', uploaded, opts: sendOpts  // No text caption!
});
console.log('Result:', JSON.stringify(result));
