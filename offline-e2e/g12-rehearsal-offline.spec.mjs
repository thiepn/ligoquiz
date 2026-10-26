import { test, expect } from '@playwright/test';
import { URL } from 'node:url';

// These tests run on the actual Vite production build, NOT on vite dev.
// Each test installs the service worker online, then forcefully disconnects the
// entire browser context and verifies both the host and a newly opened stage.
const games = [
  ['Rundenquiz', '.rq-host', 3],
  ['Quiztafel', '.qt-host', 4],
  ['Verbindungen', '.vb-host', 5],
  ['Logikleiter', '.ll-host', 3],
  ['Umfrageduell', '.ud-host', 5],
];

for (const [label, selector, count] of games) {
  test('G12 built-PWA offline restart: ' + label + ' with ' + count + ' teams', async ({ page, context }) => {
    await page.goto('/#/technik');
    await page.evaluate(() => globalThis.navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(
      () => Boolean(globalThis.navigator.serviceWorker.controller),
    )).toBe(true);
    const registration = await page.evaluate(() =>
      globalThis.navigator.serviceWorker.getRegistration().then(r => ({
        scope: r?.scope,
        active: r?.active?.state,
      })));
    expect(registration.active).toBe('activated');
    expect(new URL(registration.scope).origin).toBe(new URL(page.url()).origin);

    await page.goto('/#/setup');
    await page.getByRole('combobox', { name: 'Anzahl der Teams' }).selectOption(String(count));
    await page.getByRole('button', { name: 'Weiter' }).click();
    if (label !== 'Rundenquiz') {
      await page.getByRole('button', { name: new RegExp(label) }).click();
    }
    await page.getByRole('combobox', { name: 'Umfang' }).selectOption('kurz');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Spielleitung öffnen' }).click();
    const host = page.locator(selector);
    await expect(host).toBeVisible();
    const href = await host.getByRole('link', { name: /Beamer öffnen/ }).getAttribute('href');
    expect(href).toMatch(/^#\/stage\?event=[\w-]+$/);

    await context.setOffline(true);
    try {
      await page.reload();
      await expect(page).toHaveURL(/#\/host$/);
      await expect(host).toBeVisible();
      await expect(host).toContainText('Team ' + count);
      const stage = await context.newPage();
      await stage.goto('http://127.0.0.1:4181/' + href);
      await expect(stage.getByRole('main', { name: 'Beamer-Ansicht' })).toBeVisible();
      await expect(stage.locator('main')).not.toContainText('Josua');
      await stage.close();
      await page.goto('/#/einstellungen');
      await expect(page.getByRole('region', { name: 'Sicherung und Wiederherstellung' })).toBeVisible();
      await expect(page.getByRole('button', {
        name: 'Vollständiges Sitzungsbackup exportieren',
      })).toBeEnabled();
    } finally {
      await context.setOffline(false);
    }
  });
}

test('G33 original source-only pack plan survives installed PWA offline reload without enabling play',async({page,context})=>{
 await page.goto('/#/technik');
 await page.evaluate(()=>globalThis.navigator.serviceWorker.ready);
 await page.reload();
 await expect.poll(()=>page.evaluate(()=>Boolean(globalThis.navigator.serviceWorker.controller))).toBe(true);
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 await page.getByRole('combobox',{name:'G28 Profil'}).selectOption('kurz');
 await page.getByRole('combobox',{name:'G28 Teams'}).selectOption('3');
 await page.getByRole('combobox',{name:'G28 Spiel'}).selectOption('logikleiter');
 const saved=page.getByRole('region',{name:'G33 Lokaler Abendplan'});
 await saved.getByRole('button',{name:'Abendplan lokal speichern'}).click();
 await expect(saved).toContainText('Revision 1');
 await context.setOffline(true);
 try{
  await page.reload();
  await expect(page.getByRole('heading',{name:'Inhaltsatelier'})).toBeVisible();
  await expect(saved).toContainText('Revision 1');
  await expect(page.getByRole('combobox',{name:'G28 Spiel'})).toHaveValue('logikleiter');
  await expect(page.getByRole('combobox',{name:'G28 Profil'})).toHaveValue('kurz');
  await expect(page.getByRole('combobox',{name:'G28 Teams'})).toHaveValue('3');
  await expect(page.getByRole('region',{name:'G32 Fünf-Spiele-Abendplan'})).toContainText('NO_GO');
  await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
 }finally{await context.setOffline(false);}
});

test('G34 installed offline G10 source revision recovery keeps other slots and never authorizes release',async({page,context})=>{
 await page.goto('/#/technik');
 await page.evaluate(()=>globalThis.navigator.serviceWorker.ready);
 await page.reload();
 await expect.poll(()=>page.evaluate(()=>Boolean(globalThis.navigator.serviceWorker.controller))).toBe(true);
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const persisted=page.getByRole('region',{name:'G33 Lokaler Abendplan'});
 await persisted.getByRole('button',{name:'Abendplan lokal speichern'}).click();
 await expect(persisted).toContainText('Revision 1');
 const plan=page.getByRole('region',{name:'G30 Original-Packplanung'});
 await plan.getByText(/Aufgabenplätze und Originalquellen wählen/).click();
 const source=await plan.getByRole('combobox',{name:'G30 wissen 1'}).inputValue();
 const sibling=await plan.getByRole('combobox',{name:'G30 wissen 2'}).inputValue();
 await plan.getByRole('button',{name:source+' in G10 prüfen'}).first().click();
 const editor=page.getByRole('region',{name:'Aufgabe bearbeiten'});
 const prompt=editor.getByRole('textbox',{name:'Fragestellung'});
 await prompt.fill((await prompt.inputValue())+' – offline redaktionell geändert');
 await editor.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 await expect(persisted).toContainText('Quellen geändert');
 await context.setOffline(true);
 try{
  await page.reload();
  await expect(persisted).toContainText('Quellen geändert');
  const recover=persisted.getByRole('region',{name:'G34 Teilwiederherstellung'});
  await recover.getByRole('button',{name:'Gültige Quellen prüfen'}).click();
  await expect(recover.getByLabel('G34 Betroffene Quellplätze')).toContainText(source);
  page.once('dialog',dialog=>dialog.accept());
  await recover.getByRole('button',{name:/Quellen behalten · .* Plätze leeren/}).click();
  await expect(persisted).toContainText('Revision 2');
  await page.reload();
  await expect(persisted).toContainText('Revision 2');
  await plan.getByText(/Aufgabenplätze und Originalquellen wählen/).click();
  await expect(plan.getByRole('combobox',{name:'G30 wissen 1'})).toHaveValue('');
  await expect(plan.getByRole('combobox',{name:'G30 wissen 2'})).toHaveValue(sibling);
  await expect(page.getByRole('region',{name:'G32 Fünf-Spiele-Abendplan'})).toContainText('NO_GO');
 }finally{await context.setOffline(false);}
});

test('G35 offline editor fills one original source slot and retains approved-authority NO_GO',async({page,context})=>{
 await page.goto('/#/technik');
 await page.evaluate(()=>globalThis.navigator.serviceWorker.ready);
 await page.reload();
 await expect.poll(()=>page.evaluate(()=>Boolean(globalThis.navigator.serviceWorker.controller))).toBe(true);
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 await page.getByRole('combobox',{name:'G28 Profil'}).selectOption('kurz');
 await page.getByRole('combobox',{name:'G28 Teams'}).selectOption('3');
 const pack=page.getByRole('region',{name:'G30 Original-Packplanung'});
 await pack.getByText(/Aufgabenplätze und Originalquellen wählen/).click();
 await pack.getByRole('combobox',{name:'G30 wissen 1'}).selectOption('');
 await context.setOffline(true);
 try{
  const g35=page.getByRole('region',{name:'G35 Fünf-Spiele-Quellenwahl'});
  await g35.getByRole('combobox',{name:'G35 Quellenplatz'}).selectOption('rundenquiz/wissen:1');
  const options=g35.getByRole('region',{name:'G35 Alternative Originalquellen'});
  const button=options.getByRole('button',{name:/als Entwurf wählen/}).first();
  const label=await button.textContent(),chosen=label?.trim().split(' ')[0];
  expect(chosen).toMatch(/^rq-/);
  await button.click();
  await expect(pack.getByRole('combobox',{name:'G30 wissen 1'})).toHaveValue(chosen);
  const saved=page.getByRole('region',{name:'G33 Lokaler Abendplan'});
  await saved.getByRole('button',{name:'Abendplan lokal speichern'}).click();
  await expect(saved).toContainText('Revision 1');
  await page.reload();
  await expect(saved).toContainText('Revision 1');
  await pack.getByText(/Aufgabenplätze und Originalquellen wählen/).click();
  await expect(pack.getByRole('combobox',{name:'G30 wissen 1'})).toHaveValue(chosen);
  await expect(page.getByRole('region',{name:'G32 Fünf-Spiele-Abendplan'})).toContainText('NO_GO');
 }finally{await context.setOffline(false);}
});

test('G36 installed offline original moderator cue changes games and restores stage-safe phase',async({page,context})=>{
 await page.goto('/#/technik');
 await page.evaluate(()=>globalThis.navigator.serviceWorker.ready);
 await page.reload();
 await expect.poll(()=>page.evaluate(()=>Boolean(globalThis.navigator.serviceWorker.controller))).toBe(true);
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 await page.getByRole('combobox',{name:'G28 Profil'}).selectOption('kurz');
 await page.getByRole('combobox',{name:'G28 Teams'}).selectOption('3');
 const queue=page.getByRole('region',{name:'G36 Fünf-Spiele-Moderationslauf'});
 await context.setOffline(true);
 try{
  await queue.getByRole('button',{name:'Vorherige Phase'}).click();
  await expect(page.getByRole('combobox',{name:'G28 Spiel'})).toHaveValue('umfrageduell');
  await expect(queue).toContainText('Beamer-Vorschau');
  const saved=page.getByRole('region',{name:'G33 Lokaler Abendplan'});
  await saved.getByRole('button',{name:'Abendplan lokal speichern'}).click();
  await expect(saved).toContainText('Revision 1');
  await page.reload();
  await expect(saved).toContainText('Revision 1');
  await expect(page.getByRole('combobox',{name:'G28 Spiel'})).toHaveValue('umfrageduell');
  await expect(queue).toContainText('NO_GO');
  await expect(queue.getByLabel('G36 Öffentliche Phasenvorschau')).not.toContainText('Josua');
  await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
 }finally{await context.setOffline(false);}
});
