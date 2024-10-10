const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    popup: './src/popup/index.js',
    background: './src/background.js',
    'content-scripts/youtube-content': './src/content-scripts/youtube-content.js',
    'content-scripts/twitch-content': './src/content-scripts/twitch-content.js',
    'content-scripts/hulu-content': './src/content-scripts/hulu-content.js',
    'content-scripts/peacock-content': './src/content-scripts/peacock-content.js',
    'content-scripts/paramount-content': './src/content-scripts/paramount-content.js',
    'content-scripts/hbomax-content': './src/content-scripts/hbomax-content.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/popup/index.html',
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/icons', to: 'icons' },
      ],
    }),
  ],
};