const path = require("path");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const webpack = require("webpack");

// TODO: Look into using webpack-merge and splitting these configs instead. See https://webpack.js.org/guides/production/
const devEntries = [
    "webpack-dev-server/client?http://localhost:8080",
    "webpack-dev-server/client?http://localhost.quizbowlreader.com:8080",
    "./src/index",
];
const prodEntries = ["./src/index"];

// TODO: Use the Define plugin to setup variables like the Google Sheets app client ID, etc. from the file system or
// from env variables. See https://webpack.js.org/plugins/define-plugin/

module.exports = (env, argv) => {
    const isProduction = argv.mode === "production";

    let exports = {
        // TODO: Make a full decision on source-map vs nosources-source-map
        devtool: isProduction ? "nosources-source-map" : "eval-cheap-module-source-map",
        entry: isProduction ? prodEntries : devEntries,
        output: {
            path: path.join(__dirname, "out"),
            filename: "bundle.js",
            publicPath: "/out/",
        },
        watch: true,
        watchOptions: {
            aggregateTimeout: 1000,
            ignored: /node_modules/,
        },
        resolve: {
            extensions: [".ts", ".tsx", ".js"],
            alias: {
                src: path.join(__dirname, "src"),
            },
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    loader: "ts-loader",
                    include: path.join(__dirname, "src"),
                    options: {
                        transpileOnly: true,
                    },
                },
                {
                    test: /\.tsx??$/,
                    loader: "source-map-loader",
                    enforce: "pre",
                },
                // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
                {
                    test: /\.js$/,
                    loader: "source-map-loader",
                    enforce: "pre",
                },
            ],
        },
        plugins: [
            new ForkTsCheckerWebpackPlugin({
                eslint: {
                    files: "./src/**/*.{ts,tsx,js,jsx}",
                },
            }),
            // If you want a different Google Sheets ID, replace this with your own
            new webpack.DefinePlugin({
                __GOOGLE_CLIENT_ID__: JSON.stringify(
                    "1038902414768-nj056sbrbe0oshavft2uq9et6tvbu2d5.apps.googleusercontent.com"
                ),
            }),
            new BundleAnalyzerPlugin(),
        ],
    };

    if (!isProduction) {
        exports.devServer = {
            allowedHosts: ["localhost:8080", "quizbowlreader.com", "localhost.quizbowlreader.com"],
            // TODO: Add script and option to
            // You only need https: true if testing the Google Sheets work
            https: true,
            watchContentBase: true,
            watchOptions: {
                aggregateTimeout: 1000,
                ignored: /node_modules/,
            },
        };
    }

    return exports;
};
