// Intercept fetch to compare working vs non-working
import { readFileSync } from 'fs';
import crypto from 'crypto';

// Save original fetch
const origFetch = globalThis.fetch;
let capturedUrl, capturedHeaders, capturedBody;

globalThis.fetch = async function(url, init) {
  capturedUrl = url;
  capturedHeaders = init?.headers;
  capturedBody = init?.body;
  
  console.log('=== CAPTURED FETCH ===');
  console.log('URL:', String(url));
  console.log('Headers:', JSON.stringify(capturedHeaders, null, 2));
  console.log('Body:', String(capturedBody).substring(0, 300));
  console.log('======================');
  
  const result = await origFetch(url, init);
  const text = await result.clone().text();
  console.log('Response:', text.substring(0, 100));
  return result;
};

// Now run the working code
const td = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/token.json', 'utf-8'));
const st = JSON.parse(readFileSync(process.env.HOME + '/.wechat-acp/state.json', 'utf-8'));
const uid = "o9cq804ElOtQpY2jrM6JROSBF22Q@im.wechat";

const { sendMessage } = await import('./dist/src/weixin/api.js');

await sendMessage({
  baseUrl: td.baseUrl || 'https://ilinkai.weixin.qq.com',
  token: td.token,
  body: {
    msg: {
      from_user_id: '',
      to_user_id: uid,
      client_id: `wechat-acp-${crypto.randomUUID()}`,
      message_type: 2,
      message_state: 2,
      context_token: st.users[uid].contextToken,
      item_list: [{ type: 1, text_item: { text: 'fetch intercept' } }],
    },
  },
});
console.log('DONE - check WeChat');
