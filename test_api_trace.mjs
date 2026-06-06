// Directly test: send image via our compiled modules with full logging
import { readFileSync, writeFileSync } from 'fs';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;
const opts = { baseUrl: td.baseUrl || 'https://ilinkai.weixin.qq.com', token: td.token };
const cdnBase = 'https://novac2c.cdn.weixin.qq.com/c2c';

// Patch apiPost to log
const origFetch = globalThis.fetch;
globalThis.fetch = async function(url, init) {
  const method = init?.method || 'GET';
  const logUrl = typeof url === 'string' ? url.substring(0, 80) : String(url);
  
  if (method === 'POST' && logUrl.includes('ilink')) {
    console.log('>>> FETCH ' + method + ' ' + logUrl);
    if (init?.body) {
      const bodyStr = typeof init.body === 'string' ? init.body : '[binary]';
      console.log('>>> HEADERS:', JSON.stringify(init.headers));
      if (bodyStr !== '[binary]') {
        console.log('>>> BODY:', bodyStr.substring(0, 500));
      }
    }
  }
  return origFetch(url, init);
};

// Now import our modules (which will use the patched fetch)
const uploadMod = await import('./dist/src/weixin/upload.js');
const sendMod = await import('./dist/src/weixin/send.js');

const log = (m) => console.log('[LOG] ' + m);
const filePath = '/tmp/test_image.png';

console.log('=== UPLOAD ===');  
const uploaded = await uploadMod.uploadImageToWeixin({
  filePath, toUserId: uid, opts, cdnBaseUrl: cdnBase, log
});
console.log('Upload done. downloadParam length:', uploaded.downloadEncryptedQueryParam.length);

console.log('\n=== SEND ===');
const sendOpts = { ...opts, contextToken: st.users[uid].contextToken };
const result = await sendMod.sendImageMessage({
  to: uid, text: 'api-trace', uploaded, opts: sendOpts
});
console.log('Send result:', JSON.stringify(result));
