// Trace file send
import { readFileSync, writeFileSync } from 'fs';
import crypto from 'crypto';
import path from 'path';

const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = st.lastActiveUserId;
const opts = { baseUrl: td.baseUrl || 'https://ilinkai.weixin.qq.com', token: td.token };
const cdnBase = 'https://novac2c.cdn.weixin.qq.com/c2c';
const log = (m) => console.log('[LOG] ' + m);

// Intercept sendMessage to capture response
const origApi = await import('./dist/src/weixin/api.js');
const origSendMessage = origApi.sendMessage;
origApi.sendMessage = async function(params) {
  console.log('=== SEND CALLED ===');
  console.log('Body keys:', Object.keys(params.body));
  console.log('Has msg:', !!params.body.msg);
  if (params.body.msg) {
    console.log('msg.item_list[0].type:', params.body.msg.item_list?.[0]?.type);
    const item = params.body.msg.item_list?.[0];
    if (item?.type === 4) {
      console.log('file_item:', JSON.stringify(item.file_item));
    }
  }
  const result = await origSendMessage(params);
  // But sendMessage returns void, so we can't check the response
  // Let's check via direct fetch
  return result;
};

// Test with JSON file
const uploadMod = await import('./dist/src/weixin/upload.js');
const sendMod = await import('./dist/src/weixin/send.js');

for (const filePath of ['/tmp/test.json', '/tmp/test.pdf']) {
  console.log(`\n=== Testing ${path.basename(filePath)} ===`);
  
  const uploaded = await uploadMod.uploadFileAttachmentToWeixin({
    filePath, toUserId: uid, opts, cdnBaseUrl: cdnBase, log
  });
  console.log('Uploaded. filekey:', uploaded.filekey, 'size:', uploaded.fileSize);
  
  const sendOpts = { ...opts, contextToken: st.users[uid].contextToken };
  const result = await sendMod.sendFileMessage({
    to: uid,
    text: `File: ${path.basename(filePath)}`,
    fileName: path.basename(filePath),
    uploaded,
    opts: sendOpts,
  });
  console.log('Result:', JSON.stringify(result));
}
