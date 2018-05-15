#!/usr/bin/env node

process.title = 'fuzz-complete';

var semver = require('semver');
var version = require('../package.json').engines.node;

// Exit early if the user's node version is too low.
if (!semver.satisfies(process.version, version)) {
  var rawVersion = version.replace(/[^\d\.]*/, '');
  console.log(
      'fuzz-complete requires at least Node v' + rawVersion + '. ' +
      'You have ' + process.version + '.\n');
  process.exit(1);
}

require = require("esm")(module/*, options*/)
module.exports = require("../lib/cli.js");
