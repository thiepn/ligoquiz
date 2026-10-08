import type {Category,Tile,Profile,Team} from './engine';
import { DEPTH } from './engine';

/** Editorially UNREVIEWED local sample bank. No verified legacy import. */
const material: Record<'bibel'|'natur'|'geschichte'|'geografie'|'allgemein',readonly (readonly [string,string,string])[]> = {
  bibel:[
    ['Wer baute nach dem Alten Testament die Arche?','Noah','Genesis 6,14'],
    ['Wie heißt der Bruder von Mose?','Aaron','Exodus 4,14'],
    ['In welcher Stadt wurde Jesus geboren?','Bethlehem','Lukas 2,4–7'],
    ['Welcher Richter war für seine außergewöhnliche Kraft bekannt?','Simson','Richter 13–16'],
    ['Wie hieß die Mutter von Samuel?','Hanna','1. Samuel 1,20'],
    ['Welcher Prophet wurde nach 2. Könige 2 in einem Wirbelsturm aufgenommen?','Elia','2. Könige 2,11'],
  ],
  natur:[
    ['Welcher Stern steht im Zentrum unseres Sonnensystems?','Die Sonne','NASA — Solar System Exploration'],
    ['Welches chemische Symbol steht für Sauerstoff?','O','IUPAC Periodic Table'],
    ['Wie viele Beine hat eine Spinne?','Acht','Encyclopaedia Britannica: Spider'],
    ['Welches Gas nehmen Pflanzen bei der Fotosynthese aus der Luft auf?','Kohlenstoffdioxid','Encyclopaedia Britannica: Photosynthesis'],
    ['Wie heißt die SI-Einheit des elektrischen Widerstands?','Ohm','BIPM SI Brochure'],
    ['Welches Element besitzt die Ordnungszahl 79?','Gold','IUPAC Periodic Table'],
  ],
  geschichte:[
    ['In welchem Jahrhundert begann das Jahr 1900?','Im 19. Jahrhundert','Gregorianischer Kalender: 1801–1900'],
    ['In welchem Jahr fiel die Berliner Mauer?','1989','Bundeszentrale für politische Bildung: Mauerfall'],
    ['Wer war der erste Bundeskanzler der Bundesrepublik Deutschland?','Konrad Adenauer','Bundeskanzleramt — Bundeskanzler seit 1949'],
    ['Welche Stadt wurde im Jahr 79 beim Ausbruch des Vesuvs verschüttet?','Pompeji','UNESCO: Archaeological Areas of Pompei'],
    ['Welches antike Reich hatte Konstantinopel als Hauptstadt?','Das Byzantinische Reich','Encyclopaedia Britannica: Byzantine Empire'],
    ['Welcher Friedensschluss beendete 1648 den Dreißigjährigen Krieg?','Der Westfälische Friede','Deutsches Historisches Museum: Westfälischer Friede'],
  ],
  geografie:[
    ['Wie heißt die Hauptstadt von Frankreich?','Paris','Französische Republik'],
    ['Welcher Fluss fließt durch Köln?','Der Rhein','Stadt Köln: Rhein'],
    ['Auf welchem Kontinent liegt Kenia?','Afrika','United Nations Geoscheme'],
    ['Welches Land hat die Hauptstadt Oslo?','Norwegen','Norwegische Regierung'],
    ['Welches Meer liegt zwischen Afrika und der Arabischen Halbinsel?','Das Rote Meer','Encyclopaedia Britannica: Red Sea'],
    ['Wie heißt der höchste Berg Japans?','Fuji (Fujisan)','Japan National Tourism Organization'],
  ],
  allgemein:[
    ['Wie viele Minuten hat eine Stunde?','60','SI-Zeiteinheiten'],
    ['Wie viele Seiten hat ein Dreieck?','Drei','Euklidische Geometrie'],
    ['Was misst ein Thermometer?','Temperatur','Physikalische Messgrößen'],
    ['Welcher mathematische Begriff bezeichnet die Zahl unter dem Bruchstrich?','Nenner','Mathematische Grundbegriffe'],
    ['Welche römische Zahl steht für 50?','L','Römisches Zahlensystem'],
    ['Welcher Wissenschaftler formulierte die drei Bewegungsgesetze der klassischen Mechanik?','Isaac Newton','Newton: Principia Mathematica (1687)'],
  ],
};
const labels:Record<keyof typeof material,string>={
  bibel:'Bibel',natur:'Natur & Technik',geschichte:'Geschichte',
  geografie:'Geografie',allgemein:'Allgemeinwissen',
};
export function sampleQuiztafel(profile:Profile,teams:readonly Team[]):{
  categories:Category[];tiles:Tile[];
}{
  const keys=(Object.keys(material) as (keyof typeof material)[]).slice(0,teams.length);
  const categories=keys.map(id=>({id,name:labels[id]}));
  const tiles=keys.flatMap(categoryId=>material[categoryId].slice(0,DEPTH[profile]).map(
    ([prompt,answer,reference],index)=>({
      id:'qt-'+categoryId+'-'+(index+1),
      categoryId,row:index+1,value:(index+1)*100,
      prompt,answer,reference,
    }),
  ));
  return {categories,tiles};
}
