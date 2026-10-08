import type { Question } from './engine';
/** Trial-only pack. Not an editorially audited import of legacy v1.14. */
export const RQ_TRIAL_BANK:readonly Question[]=[
{id:'rq-w1',round:'wissen',prompt:'Wer führte Israel nach Mose in das verheißene Land?',answer:'Josua',reference:'Josua 1,1–2',durationSeconds:30},
{id:'rq-w2',round:'wissen',prompt:'Wie viele Tage hat eine Woche?',answer:'Sieben',reference:'Kalenderkonvention',durationSeconds:20},
{id:'rq-w3',round:'wissen',prompt:'In welchem Evangelium steht das Gleichnis vom barmherzigen Samariter?',answer:'Lukas',reference:'Lukas 10,25–37',durationSeconds:30},
{id:'rq-w4',round:'wissen',prompt:'Was ist die Hauptstadt von Österreich?',answer:'Wien',reference:'Österreichische Bundesverfassung Art. 5',durationSeconds:30},
{id:'rq-w5',round:'wissen',prompt:'Wer waren die Eltern von Johannes dem Täufer?',answer:'Zacharias und Elisabeth',reference:'Lukas 1,5–25',durationSeconds:30},
{id:'rq-w6',round:'wissen',prompt:'Welcher Planet ist der Sonne am nächsten?',answer:'Merkur',reference:'NASA — Mercury',durationSeconds:30},
{id:'rq-h1',round:'hinweise',prompt:'Welche biblische Person suchen wir?',answer:'David',reference:'1. Samuel 16–17',durationSeconds:80,clues:['Meine Familie wohnte in Bethlehem.','Ich spielte ein Saiteninstrument.','Ich war zunächst Hirte.','Ich besiegte Goliat.']},
{id:'rq-h2',round:'hinweise',prompt:'Welche biblische Person suchen wir?',answer:'Ester',reference:'Ester 2–7',durationSeconds:80,clues:['Meine Geschichte spielt am persischen Königshof.','Ein Verwandter warnte vor Gefahr.','Ich wurde Königin.','Ich bat den König um Hilfe gegen Haman.']},
{id:'rq-h3',round:'hinweise',prompt:'Welche biblische Person suchen wir?',answer:'Petrus',reference:'Matthäus 14; 26; Apostelgeschichte 2',durationSeconds:80,clues:['Mein Bruder hieß Andreas.','Ich war Fischer.','Ich verleugnete Jesus dreimal.','Zu Pfingsten sprach ich öffentlich.']},
{id:'rq-h4',round:'hinweise',prompt:'Welche Stadt suchen wir?',answer:'Jericho',reference:'Josua 2–6; Lukas 19',durationSeconds:80,clues:['Diese Stadt liegt westlich des Jordans.','Rahab lebte hier.','Zachäus wohnte dort.','Ihre Mauern fielen beim Einzug der Israeliten.']},
{id:'rq-s1',round:'schaetzen',prompt:'Wie viele Meter sind genau ein Kilometer?',answer:'1000 Meter',truth:'1000',unit:'Meter',reference:'SI: km = 1000 m',durationSeconds:45},
{id:'rq-s2',round:'schaetzen',prompt:'Wie viele Kapitel hat das Buch der Psalmen?',answer:'150',truth:'150',unit:'Kapitel',reference:'Psalm 1–150',durationSeconds:45},
{id:'rq-s3',round:'schaetzen',prompt:'Wie viele Minuten hat ein Tag (24 Stunden)?',answer:'1440',truth:'1440',unit:'Minuten',reference:'24 × 60',durationSeconds:45},
{id:'rq-s4',round:'schaetzen',prompt:'Wie viele Kilometer beträgt ein Marathon?',answer:'42,195 Kilometer',truth:'42.195',unit:'Kilometer',reference:'World Athletics Marathon',durationSeconds:45},
{id:'rq-f1',round:'finale',prompt:'Wer schrieb einen Brief an Philemon?',answer:'Paulus',reference:'Philemon 1,1',durationSeconds:45},
{id:'rq-f2',round:'finale',prompt:'Wie nennt man die drei Seitenlängen 3, 4 und 5 beim rechtwinkligen Dreieck?',answer:'Pythagoreisches Tripel',reference:'3² + 4² = 5²',durationSeconds:45},
];
