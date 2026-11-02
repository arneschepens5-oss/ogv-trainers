# OGV Trainers — platform van OG Vorselaar

Eén website voor alle jeugdtrainers: ploeg, kalender, aanwezigheden, uitgebreide wedstrijdverslagen,
live coachen, opstelling per kwart, evaluaties, cijfers, uitslagen van de club, trainingsbibliotheek,
trainingen plannen, spelprincipes, zonekaart, videoanalyse, animatiebord, wedstrijdblad, mixschema en scouting.

## Opbouw
- `index.html` + `app/` — het platform (één pagina, navigatie via `#/...`).
  - `app/core.js` gegevens (Supabase of demo), aanmelden, navigatie
  - `app/ploeg.js` start, ploeg, spelers, evaluaties, cijfers, instellingen
  - `app/wedstrijd.js` kalender, trainingsplan, wedstrijdverslag, opstelling per kwart, live coachen, uitslagen club
  - `app/kennis.js` bibliotheek, spelprincipes, zonekaart, videoanalyse, ingebouwde tools, mixschema, scouting
- `trainingen/` trainingsbibliotheek (PDF's, aanpasbare versies, `trainingen.json`)
- `media/` animaties van de spelprincipes en de zonekaart
- `tactiekbord/` animatiebord, `matchday/` wedstrijdblad (ingebouwd in het platform)

## Database (Supabase)
Eenmalig, en opnieuw na elke update van het script: voer `ploeg/supabase-setup.sql` uit in Supabase → SQL Editor.
Elke trainer ziet alleen de ploegen waar hij trainer van is. Uitslagen en wedstrijdverslagen zijn zichtbaar
voor alle trainers; spelersbeoordelingen alleen als de ploeg dat aanzet. Accounts maak je aan in
Supabase → Authentication → Users → Add user.

Gegevens van kinderen (spelers, scouting) staan nooit in deze (openbare) repository, alleen in Supabase.

## Uitproberen
Open de site met `?demo` voor een demo met verzonnen spelers (alleen op dat toestel).
