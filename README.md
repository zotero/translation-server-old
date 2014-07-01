An xpcshell-based approach to Zotero server side translation.

Currently supports import, export, and web translation.

Prerequisites
=============

1. Install the XULRunner SDK:

   https://developer.mozilla.org/en/Gecko_SDK/

2. Create a symlink to XULRunner inside this project directory:

   ```
   $ ln -s /path/to/where/you/put/xulrunner xulrunner-sdk
   ```

3. Fetch the Zotero extension source as a submodule:

   ```
   $ git submodule init
   $ git submodule update
   ```

4. Clone the Zotero translators repository, too:

   ```
   $ git clone https://github.com/zotero/translators.git
   ```

Configuration
=============

5. Edit config.js and update the "translation-server.translatorsDirectory" preference
   to reflect the translators directory from step 4.

Build and Run
=============

6. Run the build.sh script.  If all goes well, there should be no output.

   ```
   $ ./build.sh
   ```

7. Run the server:

   ```
   $ build/run_translation-server.sh 

   zotero(3)(+0000000): HTTP server listening on *:1969
   ```

8. Try a query!

   ```
   $ curl -d '{"url":"http://www.tandfonline.com/doi/abs/10.1080/15424060903167229","sessionid":"abc123"}' \
          --header "Content-Type: application/json" \
          localhost:1969/web
   ```

Endpoints
=========

Supported endpoints are: `/web`, `/import`, `/export`, and `/refresh`.

Read [server_translation.js](./src/server_translation.js) for more information.
