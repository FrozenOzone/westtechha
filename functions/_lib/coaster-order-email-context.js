/**
 * Email wording for submitted coaster orders.
 * Sports requests use WestTech's own preview artwork and write their selected
 * team/series information at the start of customer_notes in sports-order-checkout.js.
 * The generic custom-artwork submission keeps the original email copy.
 * No D1 schema or order-status changes are required.
 */
const DEFAULT_CONTEXT=Object.freeze({
  kind:'custom',
  customerSubject:'We received your custom coaster request',
  adminSubject:'NEW CUSTOM COASTER REQUEST',
  adminHeading:'New custom coaster request',
  adminDescription:'A customer just submitted a new Custom Coaster request.',
  details:[],adminRows:[]
});

function valueAt(lines,label){
  const row=lines.find(line=>line.startsWith(label+': '));
  return row?row.slice(label.length+2).trim().slice(0,140).replace(/[\r\n]/g,''):'';
}
function withoutId(value){return value.replace(/\s*\[[^\]]*\]\s*$/,'').trim();}
function artworkStyle(lines){
  const raw=valueAt(lines,'Artwork style');
  if(/^standard$/i.test(raw))return 'Standard';
  if(/^blackout$/i.test(raw))return 'Blackout';
  return '';
}

export function coasterOrderEmailContext(order){
  if(String(order?.artworkFilename||'').toLowerCase()!=='westtech-team-art-preview.png')return DEFAULT_CONTEXT;
  const notes=String(order?.customerNotes||'').replace(/\r\n?/g,'\n');
  // Read only the WestTech-generated header; never interpret customer-entered notes as order metadata.
  const lines=notes.split('\nCustomer notes:')[0].split('\n').slice(0,12);
  if(lines[1]!=='Sport: NFL')return DEFAULT_CONTEXT;
  const style=artworkStyle(lines);
  if(!style)return DEFAULT_CONTEXT;
  if(lines[0]==='Type: Single Team'){
    const team=withoutId(valueAt(lines,'Team'));
    if(!team)return DEFAULT_CONTEXT;
    return {
      kind:'single',
      customerSubject:'We received your custom NFL coaster request',
      adminSubject:'NEW CUSTOM NFL COASTER REQUEST',
      adminHeading:'New custom NFL coaster request',
      adminDescription:'A customer just submitted an NFL Single Team coaster request.',
      details:[`Team: ${team}`,`Artwork style: ${style}`],
      adminRows:[['Coaster type','NFL Single Team'],['Team',team],['Artwork style',style]]
    };
  }
  if(lines[0]==='Type: House Divided'){
    const side1=withoutId(valueAt(lines,'Side 1 / top'));
    const side2=withoutId(valueAt(lines,'Side 2 / bottom'));
    if(!side1||!side2)return DEFAULT_CONTEXT;
    const matchup=`${side1} / ${side2}`;
    return {
      kind:'house',
      customerSubject:'We received your NFL House Divided coaster request',
      adminSubject:'NEW NFL HOUSE DIVIDED COASTER REQUEST',
      adminHeading:'New NFL House Divided coaster request',
      adminDescription:'A customer just submitted an NFL House Divided coaster request.',
      details:[`Matchup (top / bottom): ${matchup}`,`Artwork style: ${style}`],
      adminRows:[['Coaster type','NFL House Divided'],['Matchup (top / bottom)',matchup],['Artwork style',style]]
    };
  }
  return DEFAULT_CONTEXT;
}
