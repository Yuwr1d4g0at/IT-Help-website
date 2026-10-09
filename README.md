# IT Help website
 Website for the it helping hobby

## Quote form (Web3Forms key)

The "Describe your problem" form (`/quote/` and `/pt/quote/`) sends requests through [Web3Forms](https://web3forms.com), because GitHub Pages can't run server code.

To switch it on, paste the Web3Forms access key into `js/quote-form.js`, near the top:

```js
var WEB3FORMS_ACCESS_KEY = "YOUR_WEB3FORMS_ACCESS_KEY";
```

That is the only place the key goes. While it still says `YOUR_WEB3FORMS_ACCESS_KEY`, the form sends nothing anywhere and shows visitors the WhatsApp, email and phone links instead. (A Web3Forms access key is designed to be public in front-end code; it only lets people send messages to the inbox it's tied to.)

## Safe Temp Cleaner download

`downloads/yuwri-safe-temp-cleaner.ps1` is offered on `/tools/safe-temp-cleaner/` (and the PT page) together with its SHA-256. If you change the script, update the hash and file size on both pages:

```sh
shasum -a 256 downloads/yuwri-safe-temp-cleaner.ps1
```
