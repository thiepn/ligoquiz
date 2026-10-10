export const evidenceSource={
 repository:'thiepn/ligoquiz',head:'779da5060121132508c43eec1da00cd41fa32ec4',
 runId:38040891245,artifactId:11665502348,files:[{"game":"rundenquiz","file":"rundenquiz-host-200pct.png","sha256":"433eeb05c8fb6cc5e46751c45494f1652b5d63aaff96142b6ce19a58ca73d09a"},{"game":"rundenquiz","file":"rundenquiz-projector-1280x720.png","sha256":"152048dcf748fb4f29fd448ea9b69546ee1d0e56aa59ab3b5889681f64dc3b10"},{"game":"rundenquiz","file":"rundenquiz-revealed-1280x720.png","sha256":"2113a77291ecf1add8b77cbc24c91c21e560de2fa13b69f3f12613304b06e856"},{"game":"quiztafel","file":"quiztafel-host-200pct.png","sha256":"329b3a36b789eda91ef1db4526ec60ce709ca7238c6d357d4d17c1e2bf1dbc73"},{"game":"quiztafel","file":"quiztafel-projector-1280x720.png","sha256":"4a1507c4bc004f6b275750b9da4e787217ed76e1209c6723103316b771c3af8e"},{"game":"quiztafel","file":"quiztafel-revealed-1280x720.png","sha256":"8e2c324ac848a3580f76e1455946c0c14f9f3315ea13ae876272fbb432ada957"},{"game":"verbindungen","file":"verbindungen-host-200pct.png","sha256":"aeabf26441675733c4555a744beb5c9e31c1dae3d65bc833abef52f2d048cbb1"},{"game":"verbindungen","file":"verbindungen-projector-1280x720.png","sha256":"192d98643bafea550fbc17572b4bede4242b7fda362d45252949f8628337a39e"},{"game":"verbindungen","file":"verbindungen-revealed-1280x720.png","sha256":"c2e4fc1887c3548696e657884e87bbaba49a27fce0154b89bfd4368c59d984dc"},{"game":"logikleiter","file":"logikleiter-host-200pct.png","sha256":"ad40cd1b05e73aad096e1e66a69ed63832e3ec1cb3c420c30cd8a516d08223b7"},{"game":"logikleiter","file":"logikleiter-projector-1280x720.png","sha256":"4e76e659feb0276ef91528b2d9adb8f83fbaa12be241a3a5ec2b6c00bd4a921e"},{"game":"logikleiter","file":"logikleiter-revealed-1280x720.png","sha256":"6ff89322156fe02bf6b0ad87f51a695b723e6356a8f46425b1c9f45aaec40bce"},{"game":"umfrageduell","file":"umfrageduell-host-200pct.png","sha256":"6a931831c5801e574caf34a7de692d9ef24471b349594d7976a6b03780e519fa"},{"game":"umfrageduell","file":"umfrageduell-projector-1280x720.png","sha256":"fca6a61fac2a01f63bf87b47583de20e04300f77709e1953e44f90f4adb25efa"},{"game":"umfrageduell","file":"umfrageduell-revealed-1280x720.png","sha256":"148d4f305791c68f8f8cc492017529094022ad7c299d3dbdd5408c42aeff5993"}]
} as const;
export type Observation='unreviewed'|'observed'|'defect';
export type ReviewRecord={observation:Observation;note:string};
export function reviewPacket(input:Record<string,ReviewRecord>,context:string){
 const allowed=new Set<string>(evidenceSource.files.map(v=>v.file));
 if(Object.keys(input).some(k=>!allowed.has(k)))throw new Error('Unknown screenshot reference');
 const records=evidenceSource.files.map(file=>{
  const raw=input[file.file];
  const observation=raw&&(['unreviewed','observed','defect'] as string[]).includes(raw.observation)?
   raw.observation:'unreviewed';
  return {...file,observation,note:raw?.note?.slice(0,1000).trim()??''};
 });
 const observed=records.filter(r=>r.observation==='observed').length;
 const defects=records.filter(r=>r.observation==='defect').length;
 return {format:'ligoquiz-g16-visual-observation-v1' as const,
  source:evidenceSource,notes:context.trim().slice(0,1200),records,
  summary:{observed,defects,unreviewed:records.length-observed-defects},
  humanApproval:false,physicalProjectorApproved:false,assistiveTechnologyApproved:false,
  releaseAuthorized:false,mergeAuthorized:false,deployAuthorized:false};
}
