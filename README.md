# MODAQ

**MODAQ** (**MOD**erator **A**ssistant for **Q**uizbowl) is an application for assisting moderators with reading and scorekeeping quizbowl matches. It helps track all the events that occur during the match, such as buzzes, substitutions, protests, and more. It also tracks buzz point data and can export it to a QBJ file, a JSON file, and/or TJ/UCSD Sheets.

See [the wiki](https://github.com/alopezlago/MODAQ/wiki) to learn how to use the reader.

## Importing

To use MODAQ in your project as an npm package:

1. Add `modaq` as a dependency to your `package.json` file:

   ```bash
   npm install modaq
   ```

2. In your React file, import MODAQ with:

   ```typescript
   import * as Modaq from "modaq";
   ```

   Then use the control like `<Modaq.ModaqControl />`.

3. If you want to export to Google Sheets format, you need to supply your application's client ID and include this in your HTML:

   ```html
   <script async defer src="https://apis.google.com/js/api.js"></script>
   ```

4. If you want to use the packet parser (instead of passing in a packet parameter), you need to include a URL to YAPP.

For details on props, visit the [ModaqControl props section of the MODAQ wiki](https://github.com/alopezlago/QuizBowlDiscordScoreTracker/wiki/ModaqControl-props).

## Development

### Codebase Overview

See [the MODAQ Wiki](https://github.com/alopezlago/MODAQ/wiki/Codebase-Overview) for a more thorough overview of how MODAQ works internally.

### Prerequisites

- [Node.js](https://nodejs.org/) (version 14 or higher)
- [npm](https://www.npmjs.com/get-npm) or [yarn](https://yarnpkg.com/getting-started/install)

VS Code is recommended as an IDE. If using VS Code, install the Prettier extension for code formatting.

### Setup

1. Download the [latest release](https://github.com/alopezlago/MODAQ/releases) or clone the repository:

   ```bash
   git clone https://github.com/alopezlago/MODAQ.git
   cd MODAQ
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

### Building

To build the project:

```bash
npm run build
# or
yarn build
```

This compiles TypeScript and prepares the output.

### Development Server

To run the development server:

```bash
npm run dev
# or
yarn dev
```

For testing via the Dev server (required for Google Sheets functionality), which requires HTTPS:

1. Add this entry to your hosts file (on macOS/Linux: `/etc/hosts`, on Windows: `C:\Windows\System32\drivers\etc\hosts`):

   ```bash
   127.0.0.1 localhost.quizbowlreader.com
   ```

2. Run the dev server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

3. Open https://localhost.quizbowlreader.com:8080/out

   You can accept the HTTPS certificate or create your own self-signed certificate.

### Testing

To run the tests:

```bash
npm test
# or
yarn test
```

Tests use Mocha and are located in the `tests/` directory.

### Linting

To check for linting issues:

```bash
npm run lint
# or
yarn lint
```

To automatically fix linting issues:

```bash
npm run lintFix
# or
yarn lintFix
```

### Demo

To build the demo:

```bash
npm run buildDemo
# or
yarn buildDemo
```

To serve the demo:

```bash
npm run serve
# or
yarn serve
```

## Contributing

Contributions are welcome! Please follow these steps:

1. [Fork the repository.](https://github.com/alopezlago/MODAQ/fork)
2. Create a feature branch.
3. Commit your changes to the fork's feature branch.
4. Ensure `npm run lint` and `npm test` pass without warnings or failures.
5. Submit a [pull request](https://github.com/alopezlago/MODAQ/compare).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
