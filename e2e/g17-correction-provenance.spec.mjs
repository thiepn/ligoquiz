import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
const modes=[
 {name:'Rundenquiz',root:'.rq-host',start:'Teams bestätigen'},
 {name:'Quiztafel',root:'.qt-host',start:'Quiztafel auf dem Beamer vorbereiten'},
 {name:'Verbindungen',root:'.vb-host',start:'Aufgabenreihenfolge bestätigen'},
 {name:'Logikleiter',root:'.ll-host',start:'Stufenfolge bestätigen'},
 {name:'Umfrageduell',root:'.ud-host',start:'Aufgabenfolge bestätigen'}
];
for(const mode of modes)test('G17 authentic audit history and zoomed keyboard disclosure: '+mode.name,async({page})=>{
 await page.goto('/#/setup');
 await page.getByRole('button',{name:'Weiter'}).click();
 if(mode.name!=='Rundenquiz')await page.getByRole('button',{name:new RegExp(mode.name)}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 const host=page.locator(mode.root);
 const history=host.getByRole('region',{name:'Wertungs- und Korrekturverlauf'});
 await expect(history).toContainText('0 gespeicherte Aktionen');
 await host.getByRole('button',{name:mode.start}).click();
 await expect(history).toContainText('1 gespeicherte Aktionen');
 await expect(history).toContainText('Revision 1');
 await page.setViewportSize({width:640,height:800});
 await page.evaluate(()=>{globalThis.document.documentElement.style.zoom='2';});
 const details=history.getByText(/Letzte 1 Aktionen und Revisionen prüfen/);
 await details.focus();
 await page.keyboard.press('Enter');
 await expect(history).toContainText('Spielstart bestätigt');
 await expect(history).not.toContainText(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/);
 await expect(page.locator('html')).not.toHaveJSProperty('scrollWidth',99999);
});
test('G17 operator can import consistent local evidence and reject altered notes without approval',async({page})=>{
 await page.goto('/#/technik');
 const review=page.getByRole('region',{name:'Visuelle Evidenzprüfung'});
 await review.getByRole('button',{name:'15 Bildnachweise sichten'}).click();
 await review.getByRole('combobox',{name:'Status'}).nth(0).selectOption('observed');
 const first=page.waitForEvent('download');
 await review.getByRole('button',{name:'G17-Prüfumschlag mit SHA-256 exportieren'}).click();
 const download=await first;
 const bytes=await readFile(await download.path());
 const packet=JSON.parse(bytes.toString('utf8'));
 expect(packet.packet.humanApproval).toBe(false);
 expect(packet.packet.releaseAuthorized).toBe(false);
 const input=review.getByLabel('G17-Prüfumschlag importieren');
 await input.setInputFiles({name:'verified.json',mimeType:'application/json',buffer:bytes});
 await expect(review).toContainText('15 gepinnte Bildnachweise und Prüfsumme konsistent');
 const tampered=JSON.parse(bytes.toString('utf8'));
 tampered.packet.records[0].note='Bearbeitete Behauptung';
 await input.setInputFiles({name:'tampered.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(tampered))});
 await expect(review).toContainText('Prüfung abgelehnt');
 await expect(review).toContainText('KEINE FREIGABE');
});
