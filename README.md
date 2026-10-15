# Kartaške igre 🃏

Briškula, trešeta, remi i slagalica u pregledniku — igraj **1 na 1 s prijateljem** na različitim uređajima (mobitel, tablet, računalo) ili vježbaj protiv računala.

## Kako igrati s prijateljem

1. Otvori stranicu, upiši ime, odaberi igru i klikni **Igraj s prijateljem**.
2. Kopiraj (ili podijeli) link koji dobiješ i pošalji ga prijatelju.
3. Prijatelj otvori link, upiše ime i ulazi u sobu. Domaćin klikne **Započni**.

Nije potrebna registracija ni server: uređaji se spajaju izravno (WebRTC preko [PeerJS](https://peerjs.com)).
Domaćin drži stanje igre, pa njegova kartica mora ostati otvorena. Ako netko osvježi stranicu, igra se nastavlja.

## Igre

| Igra | Špil | Ukratko |
| --- | --- | --- |
| **Briškula** | 40 talijanskih | 3 karte, adut, ne mora se odgovarati na boju, 61+ dobiva ruku |
| **Trešeta** | 40 talijanskih | 10 karata + vučenje, mora se odgovarati na boju, akuže, igra do 11/21/31/41 |
| **Remi** | 2×52 + 4 jokera | 14/15 karata, otvaranje s min. 51 bod, karta sa stola se mora iskoristiti |
| **Slagalica** | 2×52 + 4 jokera | kao remi, ali bez minimuma za otvaranje i bez obveze za kartu sa stola |

## Pokretanje lokalno

Bilo koji statički server, npr.:

```bash
python -m http.server 8765
```

pa otvori `http://localhost:8765`.

## Struktura

- `js/games/tricks.js` – pravila briškule i trešete (+ bot)
- `js/games/remi.js` – pravila remija i slagalice (+ bot)
- `js/session.js` – sobe, mreža (PeerJS), domaćin/gost
- `js/main.js` – sučelje
- `css/style.css` – dizajn
