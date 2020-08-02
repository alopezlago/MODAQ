const path = require("path");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

module.exports = {
    // TODO: Consider using source-map in production, so we can get more meaningful error messages
    devtool: "eval-cheap-module-source-map",
    entry: [
        "webpack-dev-server/client?http://localhost:8080",
        "webpack-dev-server/client?http://localhost.quizbowlreader.com:8080",
        "./src/index",
    ],
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
    devServer: {
        allowedHosts: ["localhost:8080", "quizbowlreader.com", "localhost.quizbowlreader.com"],
        watchContentBase: true,
        watchOptions: {
            aggregateTimeout: 1000,
            ignored: /node_modules/,
        },
    },
    plugins: [
        new ForkTsCheckerWebpackPlugin({
            eslint: {
                files: "./src/**/*.{ts,tsx,js,jsx}",
            },
        }),
    ],
};
