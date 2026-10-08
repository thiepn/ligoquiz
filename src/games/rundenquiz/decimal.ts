/** Exact decimal arithmetic for Rundenquiz estimates. Never round point rankings. */
export type Decimal = string;
export class DecimalInputError extends Error { constructor(message: string) {super(message);this.name='DecimalInputError';} }
const MAX_DIGITS=22, SCALE_LIMIT=9;
function pow10(x:number):bigint{return 10n**BigInt(x);}
export function normalizeDecimal(input:string|number):Decimal{
 const v=String(input).trim().replace(',','.');
 const match=/^([+-]?)(\d+)(?:\.(\d+))?$/.exec(v);
 if(!match||match[2]!.length>MAX_DIGITS||(match[3]?.length??0)>SCALE_LIMIT)
   throw new DecimalInputError('Ungültiger Dezimalwert: maximal 22 Stellen und 9 Nachkommastellen');
 const integer=match[2]!.replace(/^0+(?=\d)/,'');
 const fraction=(match[3]??'').replace(/0+$/,'');
 const sign=(integer!=='0'||fraction)&&match[1]==='-'?'-':'';
 return sign+integer+(fraction?'.'+fraction:'');
}
function asFraction(x:Decimal){const v=normalizeDecimal(x);const sign=v.startsWith('-')?-1n:1n;const u=v.replace(/^[+-]/,'');const a=u.split('.');return {n:sign*BigInt(a.join('')),scale:a[1]?.length??0};}
export function compareAbsoluteError(a:Decimal,b:Decimal,truth:Decimal):number{
 const [x,y,t]=[asFraction(a),asFraction(b),asFraction(truth)];
 const scale=Math.max(x.scale,y.scale,t.scale);
 const dist=(z:typeof x)=>{const val=z.n*pow10(scale-z.scale)-t.n*pow10(scale-t.scale);return val<0n?-val:val;};
 const da=dist(x),db=dist(y);return da<db?-1:da>db?1:0;
}
const units={
 m:['length',1n,1n],meter:['length',1n,1n],metern:['length',1n,1n],km:['length',1000n,1n],kilometer:['length',1000n,1n],cm:['length',1n,100n],mm:['length',1n,1000n],
 min:['time',60n,1n],minute:['time',60n,1n],minuten:['time',60n,1n],h:['time',3600n,1n],stunde:['time',3600n,1n],stunden:['time',3600n,1n],s:['time',1n,1n],sekunde:['time',1n,1n],sekunden:['time',1n,1n],
 kg:['mass',1000n,1n],g:['mass',1n,1n],gramm:['mass',1n,1n],
} as const;
function gcd(a:bigint,b:bigint):bigint{a=a<0n?-a:a;b=b<0n?-b:b;while(b){const r=a%b;a=b;b=r;}return a;}
function quotient(n:bigint,d:bigint):Decimal{
 const k=gcd(n,d);n/=k;d/=k;let twos=0,fives=0,left=d;
 while(left%2n===0n){twos++;left/=2n;}while(left%5n===0n){fives++;left/=5n;}
 const scale=Math.max(twos,fives);
 if(left!==1n||scale>SCALE_LIMIT)throw new DecimalInputError('Nicht exakt darstellbar; bitte Zieleinheit verwenden');
 const value=n*pow10(scale)/d,negative=value<0n,abs=negative?-value:value;
 const digits=abs.toString().padStart(scale+1,'0');
 return normalizeDecimal((negative?'-':'')+(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits));
}
export interface ParsedEstimate{value:Decimal;original:string;sourceUnit:string|null;canonicalUnit:string;converted:boolean;}
export function parseEstimateInput(raw:string,canonicalUnit:string):ParsedEstimate{
 const match=/^([+-]?\d+(?:[.,]\d+)?)\s*([\p{L}]+)?$/u.exec(raw.trim());
 if(!match)throw new DecimalInputError('Bitte Zahl und optionale Einheit eingeben (z. B. 1,8 km)');
 const value=normalizeDecimal(match[1]!),source=match[2]?.toLocaleLowerCase('de-DE')??null;
 const canon=canonicalUnit.trim().toLocaleLowerCase('de-DE');
 if(!source||source===canon)return {value,original:raw.trim(),sourceUnit:source,canonicalUnit,converted:false};
 const from=units[source as keyof typeof units],to=units[canon as keyof typeof units];
 if(!from||!to||from[0]!==to[0])throw new DecimalInputError('Einheit nicht vergleichbar: '+source+' → '+canonicalUnit);
 const q=asFraction(value);
 return {value:quotient(q.n*from[1]*to[2],pow10(q.scale)*from[2]*to[1]),original:raw.trim(),sourceUnit:source,canonicalUnit,converted:true};
}
