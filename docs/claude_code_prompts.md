# Prompts per fase — plakken in Claude Code

Eén fase per sessie. Start elke nieuwe fase met `/clear` zodat de context schoon is.
Ga pas door als het checkpoint van de vorige fase groen is.

---

## Fase A — Fundering

```
Lees docs/PLAN.md sectie 4 (datamodel) en CLAUDE.md.

Bouw het Drizzle-schema voor alle zes tabellen precies zoals in het plan
beschreven, inclusief indexen op de velden waarop we zoeken (tickets.code,
scans.client_scan_uuid, alles met organization_id).

Genereer daarna de migratie en schrijf een seed-script dat één organisatie,
één event en twee tickettypes aanmaakt.

Geef me eerst je plan van aanpak. Schrijf nog geen code tot ik akkoord geef.
```

**Checkpoint:** migratie draait schoon, seed-data zichtbaar via `psql`.

---

## Fase B — Ticketuitgifte

```
Lees docs/PLAN.md sectie 5, Fase B.

Bouw de admin-schermen: event aanmaken, tickettypes instellen, ticket uitgeven
(naam, telefoon, mail, tickettype), verkooplijst met zoeken, en ticket intrekken.

Bouw ook de HMAC-helper: genereren en verifiëren van ticketcodes, in een los
bestand met unit tests erbij. Dit is de kern van het hele systeem, dus die wil
ik apart getest hebben.

Nog geen QR, nog geen mail. Alleen uitgifte en de code.
```

**Checkpoint:** 10 tickets uitgeven, codes uniek, HMAC-tests groen, intrekken werkt.

---

## Fase C — Ticketpagina en levering

```
Lees docs/PLAN.md sectie 3.6.

Bouw de publieke ticketpagina op /t/{code}: verifieer de HMAC, toon de QR groot,
met daaronder naam, event, datum, locatie en tickettype. Toon een duidelijke
melding als het ticket ingetrokken is.

Voeg in de admin twee leverknoppen toe: een WhatsApp-knop die wa.me opent met
voorgevulde tekst plus link, en een mailknop die via Brevo verstuurt. De mail
bevat dezelfde link én de QR als afbeelding.

Leg vast in tickets.geleverd_via en geleverd_op wat er verstuurd is.
```

**Checkpoint:** ticket naar eigen nummer én mailadres, beide openen de pagina, QR scanbaar met een willekeurige app.

---

## Fase D — Scanner online

```
Lees docs/PLAN.md sectie 3.2 en 3.5.

Bouw de scanner-PWA op /scan: camera-API, QR uitlezen, scan-endpoint aanroepen.
Het endpoint gebruikt de atomaire UPDATE uit CLAUDE.md regel 2 — geen SELECT
vooraf.

Groen/rood-scherm, groot genoeg om in een donkere zaal in één blik te lezen,
met geluid en trilling. Bij rood: reden tonen, en bij al-gebruikt ook het
tijdstip en de ingang van de eerdere scan.

Bouw ook het koppelen van een scanner-sessie via een 6-cijferige code.

Nog geen offline-werking.
```

**Checkpoint:** eigen ticket → groen. Nogmaals → rood met tijdstip. Vreemde QR → rood ongeldig. Ingetrokken ticket → rood.

---

## Fase E — Scanner offline

```
Lees docs/PLAN.md sectie 3.3.

Maak de scanner offline-first:
- Bij het starten van een sessie de complete ticketlijst ophalen (alleen code en
  gebruikt_op) en in localStorage zetten
- HMAC lokaal verifiëren voordat er iets anders gebeurt
- Lokaal als gebruikt markeren, direct groen tonen
- Scan in een uploadqueue zetten met een client_scan_uuid
- Queue legen zodra er netwerk is, idempotent aan de serverkant
- Volledige sync elke 10 seconden bij netwerk, geen delta-sync

In de UI: een duidelijke indicator met "laatste sync: X min geleden" en een
teller van openstaande uploads. Weiger te starten als de lijst ouder is dan
2 uur.
```

**Checkpoint:** vliegtuigmodus aan, 20 tickets scannen inclusief duplicaten, vliegtuigmodus uit → alles komt door, geen dubbeltellingen.

---

## Fase F — Deurbeheer en rapportage

```
Lees docs/PLAN.md sectie 5, Fase F.

Bouw in de admin: overzicht van actieve scanner-sessies met de mogelijkheid ze
in te trekken, een live teller (binnen / verkocht / nog buiten), het volledige
scanlog met filter op resultaat, en een Excel-export van de verkooplijst.

Markeer conflicten in het scanlog zichtbaar: scans die binnenkwamen voor een
ticket dat de server al als gebruikt kende.
```

**Checkpoint:** twee telefoons tegelijk, beide zichtbaar, teller klopt.

---

## Tips tijdens het bouwen

- Commit na elk groen checkpoint. Een fase die stukloopt draai je dan terug
  zonder de vorige kwijt te raken.
- Gaat Claude Code vooruitlopen op een latere fase: onderbreken en zeggen
  "dat is fase X, hou je bij de huidige".
- Wordt een sessie lang en begint het antwoorden te herhalen of details te
  vergeten: `/clear` en opnieuw beginnen met de fase-prompt. Het plan staat in
  het repo, dus je raakt niets kwijt.
- Verifieer het checkpoint zelf. Niet alleen vragen of het werkt.
