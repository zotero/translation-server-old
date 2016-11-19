# Zotero Translation Server

Server-side Zotero translation

Currently supports import, export, and web translation


## Installation

### Docker (recommended)

1. `docker build -t translation-server -f Dockerfile .`
1. `docker run --rm -p 1969:1969 --name translation-server-container translation-server`

### Manually

1. Install [required libraries](https://github.com/zotero/translation-server/blob/master/Dockerfile#L4)

1. `git clone --recursive https://github.com/zotero/translation-server`

1. `cd translation-server`

1. `./fetch_sdk`

1. `./build.sh`

1. Run the server:

   ```
   $ build/run_translation-server.sh 

   zotero(3)(+0000000): HTTP server listening on *:1969
   ```

### Try a query

   ```
   $ curl -d '{"url":"http://www.tandfonline.com/doi/abs/10.1080/15424060903167229","sessionid":"abc123"}' \
          --header "Content-Type: application/json" \
          127.0.0.1:1969/web
   ```

## Endpoints

Supported endpoints are: `/web`, `/import`, `/export`, and `/refresh`.

Read [server_translation.js](./src/server_translation.js) for more information.

### Web Translators

Translates a web page

* endpoint: `/web`
* request method: `POST`
* request body: JSON object containing a `url` and a random `sessionid`
* example:
```bash
curl -X POST --header 'Content-Type: application/json' -d '{
  "url": "http://papers.ssrn.com/sol3/papers.cfm?abstract_id=1664470",
  "sessionid": "abc123"
}' 'http://localhost:1969/web'
```

### Import Translators

Converts input in any format Zotero can import (RIS, BibTeX, etc.) to items in Zotero API JSON format

* endpoint: `/import`
* request method: `POST`
* request body: item data in a supported format
* example:
```bash
curl -X POST -d 'TY  - JOUR
TI  - Die Grundlage der allgemeinen Relativitätstheorie
AU  - Einstein, Albert
PY  - 1916
SP  - 769
EP  - 822
JO  - Annalen der Physik
VL  - 49
ER  -' 'http://localhost:1969/import'
```

### Export Translators

Converts items in Zotero API JSON format to a supported export format (RIS, BibTeX, etc.)

* endpoint: `/export`
* request method: `POST`
* query parameter: `format`, which must be a [supported export format](https://github.com/zotero/translation-server/blob/master/src/server_translation.js#L31-43)
* request body: An array of items in Zotero API JSON format

## Tests

To run the tests, go to the translation-server directory and run:
```
./build/run_translation-server.sh -test /path/to/file/output.JSON
```

