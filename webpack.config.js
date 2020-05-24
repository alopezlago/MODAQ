var path = require('path');

module.exports = {
  devtool: 'source-map',
  mode: 'development',
  entry: [
    'webpack-dev-server/client?http://localhost:3000',
    './src/index'
  ],
  output: {
    path: path.join(__dirname, 'out'),
    filename: 'bundle.js',
    publicPath: '/out/'
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx']
  },
  module: {
    rules: [
      {
          test: /\.tsx?$/,
          loader: "awesome-typescript-loader",
          include: path.join(__dirname, 'src')
      },
      { 
        test: /\.tsx??$/, 
        loader: "source-map-loader", 
        enforce: "pre" 
      },
      // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
      { 
        test: /\.js$/, 
        loader: "source-map-loader", 
        enforce: "pre" 
      },
    ]
  }
};
