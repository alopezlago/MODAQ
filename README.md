# Introduction

This is a tool for reading, scorekeeping, and tracking buzz points for quiz bowl matches.

See [the wiki](https://github.com/alopezlago/QuizBowlReader/wiki) to learn how to use the reader.

# Getting Started

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

-   Open https://localhost.quizbowlreader.com:8080/

    -   You can either accept the HTTPS certificate, or you can create your own self-signed cert and add it to a certificate store. This PowerShell script should work in Windows, although I haven't tried this approach yet.

    `$cert = New-SelfSignedCertificate -certstorelocation cert:\localmachine\my -dnsname localhost.quizbowlreader.com -KeyAlgorithm ECDSA_nistP256`

# Contribute

Contributions are welcomed. Please verify that `npm lint` and `npm test` succeed without warnings or failures before submitting a pull request.
