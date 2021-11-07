var webpack = require("webpack");
var WebpackDevServer = require("webpack-dev-server");
var config = require("./webpack.config");

new WebpackDevServer(webpack(config), {
    publicPath: config.output.publicPath,
    hot: false,
    historyApiFallback: true,
}).listen(8080, "localhost.quizbowlreader.com", function (err, result) {
    if (err) {
        console.log(err);
    }

    console.log("Listening at localhost.quizbowlreader.com:8080");
});
