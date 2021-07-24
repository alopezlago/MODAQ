# Introduction

MODAQ (**MOD**erator **A**ssistant for **Q**uizbowl)  is an application for assisting moderators with reading and scorekeeping quiz bowl matches. It helps track all the events that occur during the match, such as buzzes, substituions, protests, and more. It also tracks buzz point data, and can export it to Lifsheets or a JSON file.

See [the wiki](https://github.com/alopezlago/MODAQ/wiki) to learn how to use the reader.

# Importing MODAQ in your project

To use MODAQ in your product as an npm package, do the following

1. Add `modaq` as a dependency to your `package.json` file.

2. In your React file, import MODAQ with `import * as Modaq from "modaq";`, then use the control like `<Modaq.ModaqControl />`

3. If you want to use Export to a Google Sheets format, you need to supply your application's client ID, and include this in your HTML: `<script async defer src="https://apis.google.com/js/api.js"></script>`

4. If you want to use the packet parser (instead of passing in a packet parameter), you need to include a URL to YAPP

# Getting Started

You will need to have [npm](https://www.npmjs.com/get-npm) and [yarn](https://yarnpkg.com/getting-started/install) installed on your system.

To setup the project, run

`npm init`

Then

`npm build`

Then open index.html.

VS Code is recommended as an IDE, although you can use whatever editor you like. If you install VS Code, be sure to install the Prettier VS Code extension.

# Build and Test

To build, run

`npm build`

To run the tests, run

`npm test`

If you want to use the Dev Server (required for testing Google Sheets), then do the following

-   Add this entry to your HOSTS file (in Windows, at C:\Windows\System32\drivers\etc\hosts)

    127.0.0.1 localhost.quizbowlreader.com

-   Run `npm start`

-   Open https://localhost.quizbowlreader.com:8080/out

    -   You can either accept the HTTPS certificate, or you can create your own self-signed cert and add it to a certificate store. This PowerShell script should work in Windows, although I haven't tried this approach yet.

    `$cert = New-SelfSignedCertificate -certstorelocation cert:\localmachine\my -dnsname localhost.quizbowlreader.com -KeyAlgorithm ECDSA_nistP256`

# Contribute

Contributions are welcomed. Please verify that `npm lint` and `npm test` succeed without warnings or failures before submitting a pull request.
