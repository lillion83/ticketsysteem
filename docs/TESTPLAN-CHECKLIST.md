# Testplan-checklist — vóór het echte event

Werk dit een rustig moment door, minstens een week vóór het event (PLAN §7). Een
uur oefenen bespaart een avond paniek. Vink af terwijl je gaat.

> **Let op — dev en productie delen nu dezelfde database.** Maak voor de droogtest
> een **apart TEST-event** aan (bv. naam "TEST — negeren"). Zo lopen testtickets
> niet door je echte verkoop. Na afloop kun je dat event met rust laten of de
> testtickets negeren; ze tellen alleen mee binnen dat TEST-event.

---

## 0. Voorbereiding

- [ ] Log in op de admin (tickets.mijnonline.shop) en maak een **TEST-event** aan.
- [ ] Maak 1–2 tickettypes aan (bv. "Regulier", "VIP").
- [ ] Geef **±10 testtickets** uit met verschillende namen. (50 mag ook; 10 dekt
      alle scenario's al.) Zet bij minstens één een **eigen e-mailadres** en één
      een **eigen telefoonnummer** voor de leveringstest.
- [ ] Zet bij het event **Re-entry** eerst **uit** (standaard).
- [ ] Zorg voor het toestel dat aan de deur komt + een **powerbank**.

---

## 1. Droogtest — scanner (PLAN §7.1)

### 1a. Basis groen/rood (fase D)

- [ ] Open het TEST-event → **Scannen**. Camera vraagt toestemming en toont beeld.
- [ ] Scan een geldig ticket → **groen "Welkom"**, met piep + trilling.
- [ ] Scan **hetzelfde** ticket nogmaals → **rood "Al gebruikt"** met tijdstip.
- [ ] Scan een **willekeurige QR** (bv. van een andere app/site) → **rood "Ongeldig"**.
- [ ] Trek in de admin een ticket in (verkooplijst → **intrekken**), scan het →
      **rood "Ingetrokken"**.
- [ ] Tik onderin een geldige code **handmatig** in (camera-fallback voor oude
      toestellen) → juiste uitkomst.

### 1b. Re-entry (optioneel)

- [ ] Zet bij het event **Re-entry aan**. Scan een al-gebruikt ticket →
      **groen "Welkom terug · Re-entry"**. Zet re-entry daarna weer uit.

### 1c. Offline-first (fase E)

- [ ] Laat het scannerscherm **online** volledig laden ("Online · Sync zojuist").
- [ ] Zet **vliegtuigmodus aan** → indicator wordt geel "Offline".
- [ ] Scan ~20 keer, **inclusief bewuste duplicaten**: elk uniek ticket groen,
      elke herhaling rood "Al gebruikt". Teller "X te versturen" loopt op.
- [ ] Zet **vliegtuigmodus uit** → binnen ~10s loopt de teller terug naar 0.
- [ ] **Herlaad de pagina in vliegtuigmodus** (service worker): het scannerscherm
      opent nog steeds en je kunt scannen. (Eerst weer online laten laden, dán
      vliegtuigmodus, dán herladen.)
- [ ] Controleer in **Deur & rapportage**: geen dubbeltellingen, teller klopt.

### 1d. Twee scanners + deurbeheer (fase F)

- [ ] Admin → **Deur & rapportage** → **Scanner koppelen** met label "Ingang" →
      scan de QR met telefoon 1. Herhaal met "VIP" → telefoon 2.
- [ ] Beide telefoons scannen → **beide zichtbaar** in de Scanners-tabel,
      "laatste sync" vult, scans-teller per sessie loopt op.
- [ ] **Live teller** (Binnen / Nog buiten / Verkocht) klopt en ververst.
- [ ] **Scanlog** vult met de juiste scanner-labels; filter groen/rood werkt.
- [ ] Trek een scanner in → die telefoon kan niet meer scannen.

---

## 2. Levering (fase C)

- [ ] Bij een testticket met e-mail: klik **mail** → mail komt binnen met QR
      (check ook spam de eerste keer).
- [ ] Bij een testticket met telefoon: klik **whatsapp** → voorgevulde tekst met
      link opent. Open de link → ticketpagina met grote QR.
- [ ] Scan die QR vanaf een tweede scherm → groen. (Bewijst dat de hele keten
      uitgifte → levering → scan klopt.)

---

## 3. Locatietest ter plekke (PLAN §7.2)

Doe dit op de échte locatie, mét het deurtoestel.

- [ ] **Netwerk** bij de ingang checken: is er wifi/4G? Hoe sterk?
- [ ] **Licht** checken: QR op een telefoonscherm leest slecht bij fel zonlicht of
      in het donker. Test een scan onder de echte lichtomstandigheden.
- [ ] Doe vlak vóór aanvang een **verse sync** zodat de lijst < 2 uur oud is
      (anders weigert de scanner te starten).

---

## 4. Generale (PLAN §7.3)

- [ ] Laat **vijf mensen** door de deur lopen alsof het echt is.
- [ ] **Meet de tijd per scan.** Boven de ~5 seconden krijg je een rij — oefen dan
      de handeling of zet een tweede scanner bij.
- [ ] Test bewust een **doorgestuurd ticket** (zelfde QR bij twee mensen): tweede
      krijgt rood. Eerste komt binnen (first-come-first-served).

---

## 5. Uitwijkplan op papier (PLAN §7.4)

- [ ] Admin → **Deur & rapportage** → **Export CSV** van de verkoop/scanlog.
- [ ] Open de CSV in Excel en **print de deelnemerslijst**. Kost vijf minuten en
      je hebt 'm hopelijk nooit nodig — maar als alle techniek faalt, streep je
      met de hand af.
- [ ] Zorg dat de **powerbank** vol is en leg een **tweede toestel** klaar met
      dezelfde scanner-sessie gekoppeld.

---

## Na de droogtest

- [ ] Het TEST-event met rust laten of negeren (testtickets tellen alleen binnen
      dat event). Maak het échte event apart aan.
- [ ] Twijfel over een scenario? Noteer het en pak het op vóór de dag zelf.
