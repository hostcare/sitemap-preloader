# Cache Warmer Pro — guida Docker

Come portare l'app fuori da Lovable e farla girare su un tuo container.

---

## 1. Scarica il codice

Due strade, scegli quella che hai già a disposizione:

**Via GitHub (consigliata, ti resta la sincronizzazione con Lovable)**
1. Nell'editor di Lovable: menu **+** in basso a sinistra nella chat → **GitHub** → **Connect project**
2. Autorizza l'app Lovable su GitHub e crea il repository
3. Sul tuo server:
   ```bash
   git clone https://github.com/<tuo-utente>/<tuo-repo>.git
   cd <tuo-repo>
   ```

**Via download diretto**
Apri il **Code Editor** in Lovable e clicca **Download codebase** in fondo alla sidebar dei file (funziona sui workspace a pagamento). Otterrai uno ZIP da scompattare.

---

## 2. Costruisci l'immagine

Dentro la cartella del progetto (dove c'è il `Dockerfile`):

```bash
docker build -t cache-warmer-pro .
```

La prima volta serve qualche minuto: scarica Node, installa le dipendenze e compila l'app.
Le volte successive è quasi istantanea, perché Docker riusa i livelli già costruiti.

---

## 3. Avvia il container

Con Docker Compose (consigliato):

```bash
docker compose up -d --build
```

Oppure a mano:

```bash
docker run -d \
  --name cache-warmer \
  -p 8080:80 \
  --restart unless-stopped \
  cache-warmer-pro
```

A questo punto apri **http://IP-del-tuo-server:8080** nel browser.

> La porta "8080" è quella che il tuo server espone, la "80" è quella interna del
> container. Se 8080 è già occupata, cambia il numero nel `docker-compose.yml`
> o nel comando `docker run`.

---

## 4. L'API key di Firecrawl

Serve per leggere sitemap esterne (il browser da solo non può, per il blocco CORS).

- Si inserisce **una volta** nell'interfaccia, col pulsante **Configura Firecrawl**.
- Viene salvata **nel browser** che la usa, non dentro il container.
- Quindi: se apri l'app da un altro PC, da un altro browser o in incognito, va reinserita.

---

## 5. Aggiornare l'app a una versione nuova

```bash
git pull
docker compose up -d --build
```

Il container viene ricostruito e sostituito al volo.

---

## 6. Dietro un reverse proxy (Traefik, Caddy, Nginx Proxy Manager)

Punta il proxy alla porta che hai esposto (nell'esempio, `8080`).
Dentro il container nginx serve già l'app in modo corretto per i link diretti e i
refresh di pagina, quindi non serve nessuna configurazione aggiuntiva.

---

## 7. Controlli rapidi

```bash
docker ps                          # il container è su e "healthy"?
docker logs cache-warmer           # errori di nginx?
curl -I http://localhost:8080      # deve rispondere HTTP/1.1 200 OK
```

---

## 8. Due limiti da conoscere

**a) Il warming dei singoli URL parte dal browser.**
La lettura della sitemap passa da Firecrawl e funziona ovunque. Le singole visite
di pre-caricamento invece sono richieste GET che il browser manda direttamente al
sito bersaglio: se quel sito non dichiara il permesso CORS, la richiesta viene
bloccata e la riga finisce negli errori con status `0`, anche se il sito è online.
Nel file `nginx.conf` trovi un blocco `/crawl` commentato: se lo attivi, è nginx
a fare da tramite e il problema sparisce. **Fallo solo su una rete privata** —
un proxy aperto può essere usato da chiunque per raggiungere altri siti dal tuo
server.

**b) Nessun database.**
I risultati restano in memoria e si scaricano come CSV o JSON dalla schermata
Risultati: se chiudi la pagina, la cronologia della scansione si perde.

---

## File aggiunti per il deploy

| File | A cosa serve |
| --- | --- |
| `Dockerfile` | Build in due stadi: compila con Node, serve con nginx |
| `nginx.conf` | SPA fallback, gzip, cache degli asset (e il proxy opzionale) |
| `.dockerignore` | Tiene `node_modules` e i file locali fuori dall'immagine |
| `docker-compose.yml` | Avvio con un comando solo |
