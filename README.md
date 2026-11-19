# Temu Wishlist — Ekstenzija i Web Lista Želja

Aplikacija (Chrome/Edge ekstenzija + pregledna web aplikacija) koja vam omogućava da artikle sa **Temu** stranice spremate u svoju ličnu wishlistu umjesto da ih gomilate u korpu.

## Šta dobijate?
1. **Brzo spremanje na Temuu**:
   - Na svakoj stranici artikla na `temu.com` pojavljuje se plutajuće dugme **"Dodaj u Wishlistu"** (u donjem desnom uglu).
   - **Desni klik** na bilo koji artikal na Temuu -> **"Sačuvaj u Temu Wishlistu"**.
   - **Popup ekstenzije** -> izaberite kategoriju i jednim klikom spremite trenutni artikal.
   - **Opcionalno presretanje korpe** -> u popupu možete uključiti opciju *"Presretni klik 'Dodaj u korpu'"* ako želite da i sam klik na Temuovu korpu šalje artikal u vašu wishlistu.
2. **Pregledna Web Lista Želja (`dashboard/dashboard.html`)**:
   - Pregled svih artikala sa slikom, cijenom, kategorijom, prioritetom i ličnim bilješkama.
   - Automatski proračun ukupne vrijednosti vaše liste želja.
   - Pretraga, filtriranje po kategoriji/prioritetu/statusu (*Na listi želja* / *Kupljeno*) i sortiranje po cijeni ili datumu.
   - Ručno dodavanje artikala (npr. ako kopirate link iz Temu mobilne aplikacije).
   - **Izvoz / Uvoz** u **JSON** i **CSV** (Excel) formatu.

## Kako instalirati (Chrome / Edge / Brave)
1. Otvorite **Chrome** (ili **Edge**) i u adresnu traku ukucajte:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Uključite **Developer mode** (Programerski režim) u gornjem desnom uglu.
3. Kliknite na **Load unpacked** (Učitaj raspakovanu ekstenziju).
4. Odaberite ovaj folder: `c:\Temu`
5. Prikvačite (Pin) ikonicu **Temu Wishlist** na alatnu traku radi lakšeg pristupa.

## Struktura projekta
- `manifest.json` — Konfiguracija ekstenzije (Manifest V3)
- `shared/storage.js` — Zajednički sloj za pohranu podataka i parsiranje cijena/URL-ova
- `content/temu-extractor.js` & `content/temu-ui.js` — Prepoznavanje artikala i dugme na `temu.com`
- `background/service-worker.js` — Kontekstni meni (desni klik) i brojač na ikonici
- `popup/` — Brzi popup prozor ekstenzije
- `dashboard/` — Pregledna web aplikacija za upravljanje wishlistom
