import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;
const opts = { baseUrl: td.baseUrl || 'https://ilinkai.weixin.qq.com', token: td.token };
const cdnBase = 'https://novac2c.cdn.weixin.qq.com/c2c';
const log = (m) => console.log('[LOG] ' + m);

// Intercept fetch
const origFetch = globalThis.fetch;
const captured = [];
globalThis.fetch = async function(url, init) {
  const result = await origFetch(url, init);
  if (String(url).includes('sendmessage')) {
    const respText = await result.clone().text();
    captured.push({ url: String(url), body: String(init?.body || '').substring(0, 200), response: respText });
    console.log('sendmessage response:', respText);
  }
  return result;
};

const uploadMod = await import('./dist/src/weixin/upload.js');
const sendMod = await import('./dist/src/weixin/send.js');

for (const filePath of ['/tmp/test.json', '/tmp/test.pdf']) {
  console.log(`\n=== Sending ${path.basename(filePath)} ===`);
  const uploaded = await uploadMod.uploadFileAttachmentToWeixin({
    filePath, toUserId: uid, opts, cdnBaseUrl: cdnBase, log
  });
  console.log('Upload OK. fileSize:', uploaded.fileSize);
  
  const sendOpts = { ...opts, contextToken: st.users[uid].contextToken };
  const result = await sendMod.sendFileMessage({
    to: uid, text: `File: ${path.basename(filePath)}`,
    fileName: path.basename(filePath), uploaded, opts: sendOpts,
  });
  console.log('Result:', JSON.stringify(result));
}

console.log('\n=== All sendmessage responses ===');
for (const c of captured) {
  console.log(c.response);
}
