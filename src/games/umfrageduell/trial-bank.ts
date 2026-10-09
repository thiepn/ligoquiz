import {FORMAT_COUNTS,type Profile,type Survey} from './engine';
/** Purely illustrative, locally packaged trial set. No sampled respondents or measured ranks. */
const category=(label:string,...synonyms:string[])=>({label,synonyms});
const illustrative={kind:'illustrative' as const};
const POPULAR:Survey[]=[
 {id:'ud-01',format:'popular',prompt:'Nenne eine typische Sache, die man für einen Spieleabend mitbringt.',
  categories:[category('Snacks','Knabbereien'),category('Getränke','Saft'),category('Brettspiele','Spiele'),category('Notizblock','Papier'),category('Musik','Playlist')],source:illustrative},
 {id:'ud-02',format:'popular',prompt:'Was könnte man zuerst tun, wenn man neue Gäste begrüßt?',
  categories:[category('Hallo sagen','Begrüßen'),category('Namen erfragen','Nach Namen fragen'),category('Platz anbieten','Sitzplatz zeigen'),category('Getränk anbieten','Wasser anbieten'),category('Vorstellen','Bekannt machen')],source:illustrative},
 {id:'ud-03',format:'popular',prompt:'Was braucht man häufig für einen gemeinsamen Filmabend?',
  categories:[category('Film auswählen','Auswahl treffen'),category('Bildschirm','Fernseher'),category('Popcorn','Knabbermais'),category('Decke','Kuscheldecke'),category('Bequeme Sitze','Sofa')],source:illustrative},
 {id:'ud-04',format:'popular',prompt:'Welche Tätigkeit passt zu einem freien Nachmittag?',
  categories:[category('Spazieren','Spaziergang'),category('Lesen','Buch lesen'),category('Sport','Trainieren'),category('Freunde treffen','Besuch'),category('Kochen','Backen')],source:illustrative},
 {id:'ud-05',format:'popular',prompt:'Was wird für ein gemeinsames Essen oft vorbereitet?',
  categories:[category('Geschirr','Teller'),category('Besteck','Gabeln'),category('Getränke','Wasser'),category('Servietten','Tischservietten'),category('Tischdekoration','Blumen')],source:illustrative},
 {id:'ud-06',format:'popular',prompt:'Welchen Gegenstand könnte man auf einer Wanderung einpacken?',
  categories:[category('Wasserflasche','Trinkflasche'),category('Regenjacke','Jacke'),category('Landkarte','Karte'),category('Proviant','Essen'),category('Sonnencreme','Sonnenschutz')],source:illustrative},
 {id:'ud-07',format:'popular',prompt:'Was könnte in einem Gemeinde- oder Vereinsraum stehen?',
  categories:[category('Stühle','Sitzplätze'),category('Tische','Arbeitstische'),category('Klavier','Keyboard'),category('Whiteboard','Tafel'),category('Bücher','Literatur')],source:illustrative},
 {id:'ud-08',format:'popular',prompt:'Wie könnte man ein kleines Teamprojekt gemeinsam organisieren?',
  categories:[category('Aufgaben verteilen','Rollen festlegen'),category('Termin planen','Zeit abstimmen'),category('Liste schreiben','Checkliste'),category('Material sammeln','Sachen vorbereiten'),category('Abschluss besprechen','Rückblick')],source:illustrative},
];
const TOP3:Survey[]=[
 {id:'ud-top-01',format:'top3',prompt:'Ordne drei mögliche Lieblingsaktivitäten eines fiktiven Freizeitclubs vom 1. bis 3. Platz.',
  categories:[category('Spieleabend','Spielen'),category('Ausflug','Tagesausflug'),category('Gemeinsames Kochen','Kochen'),category('Filmabend','Film'),category('Sporttreffen','Sport')],source:illustrative},
 {id:'ud-top-02',format:'top3',prompt:'Ordne drei fiktive Wünsche für die Ausstattung eines Jugendraums vom 1. bis 3. Platz.',
  categories:[category('Sitzgelegenheiten','Sofa'),category('Spiele','Brettspiele'),category('Musikanlage','Lautsprecher'),category('Bücherregal','Regal'),category('Pflanzen','Grünpflanzen')],source:illustrative},
];
export function trialUmfrageduell(profile:Profile):Survey[]{
 const {popular,top3}=FORMAT_COUNTS[profile];
 return [...POPULAR.slice(0,popular),...TOP3.slice(0,top3)].map(s=>({
  ...s,categories:s.categories.map(c=>({...c,synonyms:[...c.synonyms]})) as Survey['categories'],
 }));
}
