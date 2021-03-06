/*jshint esnext:true, node:true */
/* globals __DEV__ */
'use strict';

global.__DEV__ = (process.env.NODE_ENV != "production");

// Start by registering a hook that makes calls to `require` run ES6 code
// This will be the only file where JSX and full ES6 are not supported
require('babel/register');

let fs = require('fs');
let React = require('react');
let Router = require('react-router');
let express = require('express');
let cachify = require('connect-cachify');
let ejs = require('ejs');
let getSearchResults = require('./src/helpers/get-search-results');
let server = express();

if (__DEV__) {
  // Create and configure a webpack compiler
  let webpack = require('webpack');
  let webpackConfig = require('./webpack.config');
  let compiler = webpack(webpackConfig);

  // Attach the dev middleware to the compiler and the server
  let devMiddleware = require('webpack-dev-middleware');
  server.use(devMiddleware(compiler, {
    noInfo: true,
    publicPath: webpackConfig.output.publicPath
  }));

  // Attach the hot middleware to the compiler and the server
  let hotMiddleware = require('webpack-hot-middleware');
  server.use(hotMiddleware(compiler));
}

// List of assets where the keys are your production urls, and the value
// is a list of development urls that produce the same asset
let assets = {
  "/app.min.js": [ "/app.js" ],
  "/app.min.css": [ "/app.css" ]
};

// Enable browser cache and HTTP caching (cache busting, etc.)
server.use(cachify.setup(assets, {
  root: "assets",
  production: !__DEV__
}));

// Serve static files
server.use('/', express.static('assets'));

// Use Embedded JavaScript to embed the output from React into our layout
server.set('view engine', 'ejs');
server.set('views', 'src');

// Require and wrap the React main component in a factory before calling it
// This is necessary because we'll do `App()` instead of <App />
var routes = require("./src/app.jsx").routes;

// Redirect the user to the list of native components
server.get('/', function(req, res) {
  res.redirect('/native');
});

// Redirect legacy iOS path to the common native tab
server.get('/native-ios', function(req, res) {
  res.redirect('/native');
});

// Return the HTML page with the list of native components for iOS or components for web
server.get('/:type(web|native)', function(req, res) {
  Router.run(routes, req.url, function (handler, state) {
    let perPage = 20;
    let currentPage = Math.max(1, parseInt(state.query.page, 10) || 1);

    let searchOptions = {
      query: state.query.search,
      type: state.params.type,
      page: currentPage - 1, // In Algolia, pagination starts with 0
      perPage: perPage
    };

    getSearchResults(searchOptions, function(data) {
      let initialData = {
        initialComponents: data.components,
        initialCount: data.searchCount,
        perPage: perPage
      };

      // Render the app and send the markup for faster page loads and SEO
      // On the client, React will preserve the markup and only attach event handlers
      let Handler = React.createFactory(handler);
      let props = Object.assign({}, initialData, {
        params: state.params,
        query: state.query
      });
      let content = new Handler(props);

      res.render('layout', {
        output: React.renderToString(content),
        initialData: JSON.stringify(initialData)
      });
    });
  });
});

// Return JSON with the documentation for a given component
server.get('/api/docs/:componentName', function(req, res) {
  fs.readFile('./data/docs.json', function(error, data) {
    let docs = data ? JSON.parse(data) : {};
    res.json({ doc: docs[req.params.componentName] });
  });
});

// Listen for connections
server.listen(process.env.PORT || 8080, function() {
  console.log('Server is listening...');
});
