import {NEEDS,type Profile,type Team,type Puzzle,type WallGroup} from './engine';

/** Unreviewed test-only content; not a certified question pack or v1.14 migration. */
const clues:readonly {id:string;target:string;clues:readonly [string,string,string,string];reference:string}[]=[
 {id:'david',target:'David',clues:['Ich lebte in Bethlehem.','Ich spielte ein Saiteninstrument.','Ich war zunächst Hirte.','Ich besiegte Goliat.'],reference:'1. Samuel 16–17'},
 {id:'ester',target:'Ester',clues:['Meine Geschichte spielt am persischen Hof.','Mein Verwandter hieß Mordechai.','Ich musste meine Abstammung zunächst verschweigen.','Ich bat den König um Hilfe gegen Haman.'],reference:'Ester 2–7'},
 {id:'noah',target:'Noah',clues:['Von meiner Familie wird vor der Geschichte Abrahams erzählt.','Ich erhielt eine genaue Bauanweisung.','Meine drei Söhne heißen Sem, Ham und Jafet.','Ich baute die Arche.'],reference:'Genesis 6–9'},
 {id:'petrus',target:'Petrus',clues:['Ich lebte am See Genezareth.','Andreas war mein Bruder.','Ich verleugnete Jesus dreimal.','Meine frühere Tätigkeit war Fischer.'],reference:'Lukas 5; Matthäus 26'},
 {id:'paulus',target:'Paulus',clues:['Ich wurde in Tarsus geboren.','Zunächst verfolgte ich die Gemeinde.','Auf dem Weg nach Damaskus änderte sich mein Leben.','Ich schrieb den Brief an die Römer.'],reference:'Apostelgeschichte 9; Römer 1'},
 {id:'ruth',target:'Rut',clues:['Meine Geschichte spielt in der Richterzeit.','Ich verließ Moab mit meiner Schwiegermutter.','Ich sammelte Ähren auf einem Feld.','Ich heiratete Boas.'],reference:'Rut 1–4'},
 {id:'moses',target:'Mose',clues:['Ich wuchs im ägyptischen Umfeld auf.','Meine Geschwister waren Aaron und Mirjam.','Ich sprach vor dem Pharao.','Ich führte Israel durch das Schilfmeer.'],reference:'Exodus 2–14'},
 {id:'joseph',target:'Josef',clues:['Mein Vater hieß Jakob.','Meine Brüder verkauften mich.','In Ägypten deutete ich Träume.','Ich bekam von meinem Vater ein besonderes Gewand.'],reference:'Genesis 37–45'},
 {id:'daniel',target:'Daniel',clues:['Ich kam aus Juda an einen fremden Hof.','Meine Freunde hießen Hananja, Mischael und Asarja.','Ich deutete Träume für einen König.','Ich wurde in eine Löwengrube geworfen.'],reference:'Daniel 1–6'},
 {id:'johannes',target:'Johannes der Täufer',clues:['Meine Geburt wurde meinem Vater angekündigt.','Meine Mutter hieß Elisabeth.','Ich lebte und predigte in der Wüste.','Ich taufte Jesus im Jordan.'],reference:'Lukas 1; Matthäus 3'},
];
const sequences:readonly {id:string;prompt:string;items:readonly [string,string,string];answer:string;explanation:string;reference:string}[]=[
 {id:'gospels',prompt:'Die vier Evangelien in der Reihenfolge des Neuen Testaments',items:['Matthäus','Markus','Lukas'],answer:'Johannes',explanation:'Matthäus, Markus, Lukas, Johannes',reference:'Kanonische Reihenfolge NT'},
 {id:'squares',prompt:'Die ersten vier positiven Quadratzahlen',items:['1','4','9'],answer:'16',explanation:'1², 2², 3², 4²',reference:'n² für n = 1, 2, 3, 4'},
 {id:'week',prompt:'Wochentage ab Montag ohne Auslassungen',items:['Montag','Dienstag','Mittwoch'],answer:'Donnerstag',explanation:'Kanonische Wochentagsreihenfolge',reference:'ISO 8601 Wochentage'},
 {id:'tens',prompt:'Aufsteigende Vielfache von zehn beginnend mit zehn',items:['10','20','30'],answer:'40',explanation:'Jeweils +10',reference:'Elementare Arithmetik'},
 {id:'letters',prompt:'Alphabetische Reihenfolge der ersten vier deutschen Buchstaben',items:['A','B','C'],answer:'D',explanation:'A, B, C, D',reference:'Deutsches Alphabet'},
];
const wallGroups:readonly WallGroup[]=[
 {id:'evangelien',tileIds:['matthaeus','markus','lukas','johannes'],link:'Evangelien',acceptedLinks:['vier Evangelien','Evangelien']},
 {id:'richtungen',tileIds:['norden','sueden','osten','westen'],link:'Himmelsrichtungen',acceptedLinks:['vier Himmelsrichtungen','Himmelsrichtungen']},
 {id:'jahreszeiten',tileIds:['fruehling','sommer','herbst','winter'],link:'Jahreszeiten',acceptedLinks:['vier Jahreszeiten','Jahreszeiten']},
 {id:'rechnung',tileIds:['addition','subtraktion','multiplikation','division'],link:'Grundrechenarten',acceptedLinks:['Grundrechenarten','vier Grundrechenarten']},
];
const labels:Record<string,string>={
 matthaeus:'Matthäus',markus:'Markus',lukas:'Lukas',johannes:'Johannes',
 norden:'Norden',sueden:'Süden',osten:'Osten',westen:'Westen',
 fruehling:'Frühling',sommer:'Sommer',herbst:'Herbst',winter:'Winter',
 addition:'Addition',subtraktion:'Subtraktion',multiplikation:'Multiplikation',division:'Division',
};
const shuffled=['markus','winter','osten','division','lukas','sueden','sommer','addition',
 'johannes','norden','fruehling','subtraktion','matthaeus','westen','herbst','multiplikation'];
export function trialVerbindungen(profile:Profile,teams:readonly Team[]):Puzzle[]{
 const needs=NEEDS[profile];
 return [
  ...clues.slice(0,teams.length*needs.clues).map(p=>({
   ...p,id:'vb-a-'+p.id,kind:'clues' as const,
  })),
  ...sequences.slice(0,teams.length*needs.sequences).map(p=>({
   ...p,id:'vb-b-'+p.id,kind:'sequence' as const,
  })),
  {id:'vb-wall-1',kind:'wall',tiles:shuffled.map(id=>({id,label:labels[id]!})),
   groups:wallGroups,reference:'Spielinterne, redaktionell ungeprüfte Mustersammlung'},
 ];
}
