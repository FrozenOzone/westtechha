import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const source=fs.readFileSync(path.join(root,'functions/_lib/tax.js'),'utf8');
function moduleFromSource(){
 const imports=[
  ['import { PRODUCT } from "./product.js";','const PRODUCT={itemAmount:30,shippingAmount:4.50};'],
  ['import { readJsonSafe, sanitizeEnvValue } from "./shared.js";','const readJsonSafe=async r=>r.json(); const sanitizeEnvValue=x=>String(x??"").trim();']
 ];
 let js=source;
 for (const [existing, replacement] of imports) {
  assert.ok(js.includes(existing),`Cannot replace module import: ${existing}`);
  js=js.replace(existing,replacement);
 }
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
const modulePromise=moduleFromSource();
const addr={fullName:'PRIVATE CLIENT FULL NAME',address1:'9876 Highly Private Lane',address2:'Unit 42',city:'Fort Collins',state:'CO',postalCode:'80521',countryCode:'US'};

async function simulate({providerResult, providerStatus=200, address=addr, options={taxableAmount:30,itemAmount:30,shippingAmount:4.5}, env={CO_GIS_API_KEY:'fake-key'}}={}){
 const mod=await modulePromise;
 const logs=[];const requests=[];
 const originalLog=console.log,originalWarn=console.warn,originalError=console.error,originalInfo=console.info,originalDebug=console.debug,originalFetch=globalThis.fetch;
 for (const type of ['log','warn','error','info','debug'])console[type]=(...args)=>logs.push(JSON.stringify(args));
 globalThis.fetch=async (url,params)=>{requests.push({url,params});return {ok:providerStatus>=200&&providerStatus<300,status:providerStatus,json:async()=>providerResult??{totalSalesTax:0.0825, jurisdictionCode:'CO-TEST',address:'9876 Highly Private Lane, Fort Collins, CO 80521',salesTax:[]}}};
 try{return {quote:await mod.buildTaxQuote(env,address,options),logs,requests}}
 finally{console.log=originalLog;console.warn=originalWarn;console.error=originalError;console.info=originalInfo;console.debug=originalDebug;globalThis.fetch=originalFetch;}
}

test('tax module contains no direct console logging of raw customer or provider data',()=>{
 assert.doesNotMatch(source,/\bconsole\s*\./);
 assert.match(source,/address: buildColoradoAddressString\(address\)/);
 assert.match(source,/body: JSON.stringify\(payload\)/);
 assert.match(source,/const taxAmount = Number\(\(taxableAmount \* taxRate\)\.toFixed\(2\)\)/);
});
test('Colorado quote retains complete address for provider and unchanged math, without logging PII',async()=>{
 const {quote,logs,requests}=await simulate();
 assert.equal(quote.taxableAmount,'30.00');assert.equal(quote.shippingAmount,'4.50');
 assert.equal(quote.taxAmount,'2.48');assert.equal(quote.totalAmount,'36.98');assert.equal(quote.taxRate,0.0825);
 assert.equal(quote.address.address1,addr.address1);
 assert.equal(quote.apiAddress,'9876 Highly Private Lane, Fort Collins, CO 80521');
 assert.equal(requests.length,1);
 const sent=JSON.parse(requests[0].params.body);
 assert.ok(sent.address.includes(addr.address1));assert.ok(sent.address.includes(addr.postalCode));
 assert.deepEqual(logs,[]);
});
test('out-of-state quote keeps existing zero-tax behavior and no address logs',async()=>{
 const other={...addr,city:'Phoenix',state:'AZ',postalCode:'85001'};
 const {quote,logs,requests}=await simulate({address:other});
 assert.equal(quote.taxAmount,'0.00');assert.equal(quote.totalAmount,'34.50');
 assert.equal(quote.source,'out-of-state');assert.equal(requests.length,0);assert.deepEqual(logs,[]);
});
test('invalid shipping address still fails and is never written to logs',async()=>{
 const mod=await modulePromise;
 const logs=[];const original=console.log;console.log=(...args)=>logs.push(args);
 try{await assert.rejects(mod.buildTaxQuote({CO_GIS_API_KEY:'fake-key'},{...addr,address1:''}),/street address/);assert.deepEqual(logs,[]);}
 finally{console.log=original;}
});
test('raw provider response with identifying text is not logged',async()=>{
 const {quote,logs}=await simulate({providerResult:{totalSalesTax:0.0825,address:'PRIVATE ADDRESS FROM PROVIDER',message:'PRIVATE NAME AND ADDRESS',salesTax:[]}});
 assert.equal(quote.apiAddress,'PRIVATE ADDRESS FROM PROVIDER');assert.deepEqual(logs,[]);
});
test('tax calculation retains nondefault taxable amount and half-cent rounding behavior',async()=>{
 const {quote,logs}=await simulate({options:{taxableAmount:12.50,itemAmount:12.50,shippingAmount:3.00}});
 assert.equal(quote.taxAmount,'1.03');assert.equal(quote.totalAmount,'16.53');assert.deepEqual(logs,[]);
});
