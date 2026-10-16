/* Customer-owned confirmed pickup details. Never expose location before booking. */
const ZONE='America/Denver';
function safeSetting(value,max){return String(value??'').trim().replace(/[\r\n]+/g,', ').slice(0,max);}
export function confirmedPickupDetails(env,pickup){
  if(!pickup?.appointment||pickup.appointment.status!=='CONFIRMED')return null;
  const address=safeSetting(env?.WESTTECH_PICKUP_LOCATION,320);
  const instructions=safeSetting(env?.WESTTECH_PICKUP_INSTRUCTIONS,600);
  return {location:address?{name:'WestTech Home Automation Pickup',address,instructions}:null};
}
function escapeText(value){return String(value??'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
function folded(value){
  const enc=new TextEncoder();let segment='',output=[];
  for(const c of String(value)){
    if(enc.encode(segment+c).length>73&&segment){output.push(segment);segment=c;}
    else segment+=c;
  }
  if(segment)output.push(segment);
  return output.join('\r\n ');
}
function utcLine(value){return new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');}
export function buildPickupIcs(pickup,details){
  const apt=pickup?.appointment;
  if(!apt||apt.status!=='CONFIRMED'||!apt.startAtUtc)throw Object.assign(new Error('No confirmed pickup appointment is available.'),{status:409});
  const begin=new Date(apt.startAtUtc),finish=new Date(begin.getTime()+15*60*1000);
  if(!Number.isFinite(begin.getTime()))throw Object.assign(new Error('The confirmed pickup time is invalid.'),{status:409});
  const address=details?.location?.address||'';
  const description=['Your 15-minute WestTech coaster pickup.',`Order: ${pickup.orderId}.`,
    details?.location?.instructions||'The pickup location and instructions are available in your private WestTech Customer Portal.'].join('\n');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//WestTech Home Automation//Coaster Pickup//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    `UID:pickup-${String(pickup.orderId).replace(/[^A-Za-z0-9-]/g,'')}-${Number(apt.id)||0}@westtechha.com`,
    `DTSTAMP:${utcLine(new Date())}`,`DTSTART:${utcLine(begin)}`,`DTEND:${utcLine(finish)}`,
    `SUMMARY:${escapeText('WestTech Coaster Pickup')}`,
    `DESCRIPTION:${escapeText(description)}`,
    ...(address?[`LOCATION:${escapeText(address)}`]:[]),
    'STATUS:CONFIRMED','END:VEVENT','END:VCALENDAR'];
  return lines.map(folded).join('\r\n')+'\r\n';
}
