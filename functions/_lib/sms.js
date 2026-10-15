import { requireOrdersDb } from './orders.js';
import { mobileCarrierLabel, mobileGatewayAddress, normalizeMobileCarrier, normalizeUsMobile } from './mobile-carriers.js';

const EVENT_TABLES={COASTER:'coaster_order_events',ENCLOSURE:'enclosure_order_events',CUSTOM:'custom_order_events'};
function clean(value,max=500){return String(value??'').trim().slice(0,max);}
function consented(order){return String(order?.communicationPreference||'').toUpperCase()==='SMS'&&order?.smsConsent===true;}
function smtpUser(env){return clean(env?.TEXT_GATEWAY_SMTP_USER||env?.GMAIL_SMTP_USER,254);}
function smtpPassword(env){return String(env?.TEXT_GATEWAY_SMTP_PASSWORD||env?.GMAIL_SMTP_APP_PASSWORD||'').replace(/\s+/g,'').slice(0,500);}
function smtpHost(env){return clean(env?.TEXT_GATEWAY_SMTP_HOST||'smtp.gmail.com',253);}
function smtpPort(env){const value=Number(env?.TEXT_GATEWAY_SMTP_PORT||465);return Number.isInteger(value)&&value>0&&value<=65535?value:465;}
function smtpConfigured(env){return !!(smtpUser(env)&&smtpPassword(env));}
function replyTo(env){return clean(env?.COASTER_EMAIL_REPLY_TO||env?.ORDERS_EMAIL||'orders@westtechha.com',254);}
function header(value,max=254){return clean(value,max).replace(/[\r\n]+/g,' ');}
function asciiText(value,max=300){return clean(value,max).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/[^\x20-\x7E\r\n]/g,' ').replace(/[ \t]+/g,' ').trim();}
function b64(value){const bytes=new TextEncoder().encode(String(value??''));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);}
function messageId(idempotencyKey){const id=clean(idempotencyKey,140).replace(/[^A-Za-z0-9._-]/g,'-')||`gateway-${Date.now()}`;return `<${id}@westtechha.com>`;}
function smtpMessage({from,to,replyToAddress,text,idempotencyKey}){
  const body=asciiText(text,300).replace(/\r?\n/g,'\r\n').replace(/^\./gm,'..');
  return [
    `From: WestTech Home Automation <${header(from)}>`,
    `To: ${header(to)}`,
    `Reply-To: ${header(replyToAddress)}`,
    'Subject: WestTech order update',
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId(idempotencyKey)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
  ].join('\r\n');
}
function withTimeout(promise,ms,label){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),ms);})]).finally(()=>clearTimeout(timer));}
function responseError(stage,response){const detail=clean(response?.lines?.join(' | '),600)||'No response from SMTP server.';return new Error(`${stage}: ${detail}`);}
async function openSmtpSocket(env){
  const {connect}=await import('cloudflare:sockets');
  return connect({hostname:smtpHost(env),port:smtpPort(env)},{secureTransport:'on'});
}
function smtpSession(socket){
  const reader=socket.readable.getReader(),writer=socket.writable.getWriter(),decoder=new TextDecoder(),encoder=new TextEncoder();let buffer='';
  async function readResponse(){
    const lines=[];
    while(true){
      let newline;
      while((newline=buffer.indexOf('\n'))>=0){
        let line=buffer.slice(0,newline+1);buffer=buffer.slice(newline+1);line=line.replace(/\r?\n$/,'');if(!line)continue;lines.push(line);
        const match=line.match(/^(\d{3})([ -])/);if(match&&match[2]===' ')return {code:Number(match[1]),lines};
      }
      const chunk=await withTimeout(reader.read(),15000,'SMTP response timed out.');
      if(chunk.done)throw new Error('SMTP connection closed unexpectedly.');
      buffer+=decoder.decode(chunk.value,{stream:true});
    }
  }
  async function write(value){await withTimeout(writer.write(encoder.encode(value)),15000,'SMTP write timed out.');}
  async function command(value,expected,stage){await write(`${value}\r\n`);const response=await readResponse();if(!expected.includes(response.code))throw responseError(stage,response);return response;}
  async function data(value){await write(`${value}\r\n.\r\n`);const response=await readResponse();if(response.code!==250)throw responseError('SMTP DATA',response);return response;}
  return {readResponse,command,data,release(){try{reader.releaseLock();}catch{}try{writer.releaseLock();}catch{}}};
}
async function sendGatewayViaSmtp(env,{to,text,idempotencyKey}){
  if(typeof env?.__TEXT_GATEWAY_TEST_SEND==='function')return env.__TEXT_GATEWAY_TEST_SEND({to,text,idempotencyKey});
  const user=smtpUser(env),password=smtpPassword(env);if(!user||!password)throw new Error('Gmail SMTP gateway is not configured.');
  const socket=await openSmtpSocket(env),session=smtpSession(socket);
  try{
    const banner=await session.readResponse();if(banner.code!==220)throw responseError('SMTP connect',banner);
    await session.command('EHLO westtechha.com',[250],'SMTP EHLO');
    await session.command('AUTH LOGIN',[334],'SMTP AUTH');
    await session.command(b64(user),[334],'SMTP username');
    await session.command(b64(password),[235],'SMTP password');
    await session.command(`MAIL FROM:<${user}>`,[250],'SMTP MAIL FROM');
    await session.command(`RCPT TO:<${to}>`,[250,251],'SMTP RCPT TO');
    await session.command('DATA',[354],'SMTP DATA start');
    const accepted=await session.data(smtpMessage({from:user,to,replyToAddress:replyTo(env),text,idempotencyKey}));
    try{await session.command('QUIT',[221,250],'SMTP QUIT');}catch{}
    return {sent:true,providerId:clean(accepted.lines?.join(' | '),300)};
  }finally{session.release();try{socket.close();}catch{}}
}
async function log(env,sourceType,orderId,eventType,detail){const table=EVENT_TABLES[String(sourceType||'').toUpperCase()];if(!table||!orderId)return;try{await requireOrdersDb(env).prepare(`INSERT INTO ${table} (order_id,event_type,detail) VALUES (?,?,?)`).bind(orderId,eventType,JSON.stringify(detail)).run();}catch{}}
async function alreadySent(env,sourceType,orderId,key){const table=EVENT_TABLES[String(sourceType||'').toUpperCase()];if(!table||!orderId)return false;try{const needle=`\"idempotencyKey\":\"${key}\"`,row=await requireOrdersDb(env).prepare(`SELECT id FROM ${table} WHERE order_id=? AND event_type='TEXT_GATEWAY_SENT' AND instr(detail,?)>0 LIMIT 1`).bind(orderId,needle).first();return !!row;}catch{return false;}}

export function smsConfigured(env){return smtpConfigured(env);}
export function transactionalSmsText({subject='',orderId=''}={}){
  const title=clean(subject,120).replace(/\s+[—-]\s+[^—-]+$/,'').replace(/[.!]+$/,'');
  return [`WestTech: ${title||'Your order has an update'}.`,orderId?`Order ${clean(orderId,80)}.`:'','Full details were sent to your email.'].filter(Boolean).join(' ').slice(0,300);
}

export async function sendTransactionalSms(env,{sourceType,order,eventType,message,idempotencyKey}={}){
  const type=String(sourceType||'').toUpperCase(),orderId=clean(order?.orderId,80),key=clean(idempotencyKey,240),carrier=normalizeMobileCarrier(order?.mobileCarrier),digits=normalizeUsMobile(order?.customerPhone||order?.phone),to=mobileGatewayAddress(order?.customerPhone||order?.phone,carrier);
  if(!EVENT_TABLES[type]||!orderId||!key)return {sent:false,skipped:true,reason:'invalid-text-gateway-event'};
  if(!consented(order))return {sent:false,skipped:true,reason:'text-not-preferred-or-consented'};
  if(!digits){await log(env,type,orderId,'TEXT_GATEWAY_SKIPPED_INVALID_PHONE',{messageType:eventType,idempotencyKey:key});return {sent:false,skipped:true,reason:'invalid-mobile-phone',idempotencyKey:key};}
  if(!to){await log(env,type,orderId,'TEXT_GATEWAY_UNSUPPORTED',{messageType:eventType,carrier:carrier||'UNKNOWN',carrierLabel:mobileCarrierLabel(carrier)||'Unknown',idempotencyKey:key});return {sent:false,skipped:true,reason:'carrier-gateway-unavailable',idempotencyKey:key};}
  if(await alreadySent(env,type,orderId,key))return {sent:true,duplicate:true,idempotencyKey:key};
  if(!smtpConfigured(env)){await log(env,type,orderId,'TEXT_GATEWAY_NOT_CONFIGURED',{messageType:eventType,carrier,transport:'GMAIL_SMTP',idempotencyKey:key});return {sent:false,skipped:true,reason:'Gmail SMTP gateway is not configured',idempotencyKey:key};}
  try{
    const result=await sendGatewayViaSmtp(env,{to,text:clean(message,300),idempotencyKey:key});
    await log(env,type,orderId,'TEXT_GATEWAY_SENT',{messageType:eventType,carrier,carrierLabel:mobileCarrierLabel(carrier),provider:'GMAIL_SMTP_EMAIL_TO_TEXT_GATEWAY',providerId:result?.providerId||null,idempotencyKey:key});return {sent:true,id:result?.providerId||null,idempotencyKey:key};
  }catch(error){const detail=clean(error?.message,500)||'Carrier gateway delivery failed.';await log(env,type,orderId,'TEXT_GATEWAY_FAILED',{messageType:eventType,carrier,provider:'GMAIL_SMTP_EMAIL_TO_TEXT_GATEWAY',message:detail,idempotencyKey:key});return {sent:false,error:detail,idempotencyKey:key};}
}
