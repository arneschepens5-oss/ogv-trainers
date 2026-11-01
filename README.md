# OGV Trainersportaal

Startscherm met alle trainersapps van OG Vorselaar. Installeer het op je gsm via
"Zet op beginscherm" (iPhone) of "App installeren" (Android).

Een app toevoegen: zet een blok bij in `apps.json`.

## Matchday-blad (`matchday/`)
Wedstrijdblad voor de kleedkamer voor elke ploeg van de club: kies 2v2, 3v3, 5v5, 8v8 of 11v11,
een opstelling (of sleep zelf de posities), vink de selectie aan, kies kapitein en 1 tot 3 opdrachten,
en druk af op A4. Gegevens blijven in de browser van het toestel; een trainer kan meerdere ploegen bewaren.

## Animatiebord (`tactiekbord/`)
Tactiekbord om spelvormen uit te tekenen en te animeren: 5v5, 8v8, 11v11 of een oefenzone op maat.
Spelers, materiaal, pijlen (pass, loopactie, dribbel), zones, verbindingslijnen en tekst; stappen met
coachingspunt die je afspeelt. Export als video (MP4/WebM), PNG of PDF, en delen als link of .json.
Borden blijven in de browser van het toestel; maak via het startscherm een back-up van alle borden.
Inloggen (optioneel) loopt via Supabase: elke trainer ziet alleen zijn eigen borden, op elk toestel.
Accounts maakt de beheerder aan in Supabase (Authentication → Users → Add user). De tabel staat in
`tactiekbord/supabase-setup.sql`.

## Mijn ploeg (`ploeg/`)
Ploegapp naar het voorbeeld van PSD: spelers, kalender, aanwezigheden, wedstrijd- en trainingsverslag,
evaluaties (4 momenten, score 1-5 per onderdeel), persoonlijke doelen en ploegcijfers met export naar Excel.
Gegevens staan in Supabase; elke trainer ziet alleen de ploegen waaraan hij gekoppeld is. Dezelfde login
als het Animatiebord. Eenmalig klaarzetten: voer `ploeg/supabase-setup.sql` uit in Supabase → SQL Editor.
Uitproberen zonder account: open `ploeg/?demo` (verzonnen spelers, alleen op dat toestel).

## Trainingsbibliotheek (`trainingen/`)
Alle trainingen uit SharePoint (OGV Sportief Trainers → Trainingen) per leeftijdsgroep, met PDF en aanpasbare
versie. De lijst staat in `trainingen/trainingen.json`.
