const path = require("path");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const webpack = require("webpack");

const devEntries = [
    "webpack-dev-server/client?http://localhost:8080",
    "webpack-dev-server/client?http://localhost.quizbowlreader.com:8080",
    "./src/demo/app",
];
const prodEntries = ["./src/demo/app"];
const dateString = new Date().toISOString();
const version = dateString.substring(0, dateString.indexOf("T"));

module.exports = (env, argv) => {
    const isProduction = argv.mode === "production";

    let exports = {
        // TODO: Make a full decision on source-map vs nosources-source-map
        devtool: isProduction ? "nosources-source-map" : "eval-cheap-module-source-map",
        entry: isProduction ? prodEntries : devEntries,
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
        output: {
            path: path.join(__dirname, "out"),
            filename: "[name].bundle.js",
            publicPath: "/out/",
            umdNamedDefine: true,
            clean: true,
        },
        plugins: [
            new ForkTsCheckerWebpackPlugin({
                eslint: {
                    files: "./src/**/*.{ts,tsx,js,jsx}",
                },
            }),
            // Update Tests\TestInit.js to include values for these constants
            new webpack.DefinePlugin({
                __BUILD_VERSION__: JSON.stringify(`${isProduction ? "" : "dev_"}${version}`),
                // If you want a different Google Sheets ID, replace this with your own
                __GOOGLE_CLIENT_ID__: JSON.stringify(
                    "1038902414768-nj056sbrbe0oshavft2uq9et6tvbu2d5.apps.googleusercontent.com"
                ),
                // If you're testing the YAPP Azure Function locally, use http://localhost:7071/api/ParseDocx, and
                // make sure local.settings.json includes this after the Values field:
                // "Host": { "LocalHttpPort": 7071, "CORS": "*" }
                __YAPP_SERVICE__: JSON.stringify(
                    "https://yetanotherpacketparserazurefunction.azurewebsites.net/api/ParseDocx"
                ),
            }),
        ],
    };

    exports.plugins.push(
        new HtmlWebpackPlugin({
            title: "Moderator Assistant for Quizbowl",
            template: "./indexTemplate.html",
        })
    );

    exports.optimization = {
        splitChunks: {
            chunks: "all",
        },
    };

    if (isProduction) {
        // Open the bundle size analyzer in production, since it's not useful in debug builds
        exports.plugins.push(new BundleAnalyzerPlugin());
    } else {
        exports.watchOptions = {
            aggregateTimeout: 1000,
            ignored: /node_modules/,
        };
        exports.devServer = {
            allowedHosts: ["localhost:8080", "quizbowlreader.com", "localhost.quizbowlreader.com"],
            // TODO: Add script and option to
            // You only need https: true if testing the Google Sheets work
            https: true,
            publicPath: "/out/",
            watchContentBase: true,
            watchOptions: {
                aggregateTimeout: 1000,
                ignored: /node_modules/,
            },
        };
    }

    return exports;
};
