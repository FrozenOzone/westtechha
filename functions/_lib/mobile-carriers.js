const CARRIERS={
  VERIZON:{label:'Verizon',gateway:'vtext.com'},
  TMOBILE:{label:'T-Mobile',gateway:'tmomail.net'},
  METRO:{label:'Metro by T-Mobile',gateway:'mymetropcs.com'},
  MINT:{label:'Mint Mobile',gateway:'tmomail.net'},
  VISIBLE:{label:'Visible',gateway:'vtext.com'},
  XFINITY:{label:'Xfinity Mobile',gateway:'vtext.com'},
  BOOST:{label:'Boost Mobile',gateway:'sms.myboostmobile.com'},
  CRICKET:{label:'Cricket Wireless',gateway:'sms.cricketwireless.net'},
  US_CELLULAR:{label:'U.S. Cellular',gateway:'email.uscc.net'},
  GOOGLE_FI:{label:'Google Fi',gateway:'msg.fi.google.com'},
  ATT:{label:'AT&T',gateway:''},
  CONSUMER_CELLULAR:{label:'Consumer Cellular',gateway:''},
  OTHER:{label:'Other / not listed',gateway:''}
};

export function normalizeMobileCarrier(value){const carrier=String(value??'').trim().toUpperCase();return Object.hasOwn(CARRIERS,carrier)?carrier:'';}
export function isKnownMobileCarrier(value){return !!normalizeMobileCarrier(value);}
export function mobileCarrierLabel(value){const carrier=normalizeMobileCarrier(value);return carrier?CARRIERS[carrier].label:'';}
export function carrierSupportsGateway(value){const carrier=normalizeMobileCarrier(value);return !!(carrier&&CARRIERS[carrier].gateway);}
export function normalizeUsMobile(value){const digits=String(value??'').replace(/\D/g,'');if(digits.length===10)return digits;if(digits.length===11&&digits.startsWith('1'))return digits.slice(1);return '';}
export function mobileGatewayAddress(phone,carrier){const digits=normalizeUsMobile(phone),normalized=normalizeMobileCarrier(carrier),gateway=normalized&&CARRIERS[normalized].gateway;return digits&&gateway?`${digits}@${gateway}`:'';}

