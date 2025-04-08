const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }]
  },
  resolve: { extensions: ['.ts', '.js'] },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  devServer: {
    static: path.join(__dirname, 'dist'),
    hot: true,
    port: 9000
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './src/index.html', title: 'Bomb Catcher' }),
    new CopyPlugin({ patterns: [{ from: 'assets', to: 'assets' }] })
  ]
};