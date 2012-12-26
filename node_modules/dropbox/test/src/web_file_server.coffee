express = require 'express'
fs = require 'fs'
https = require 'https'
open = require 'open'

# Tiny express.js server for the Web files.
class WebFileServer
  # Starts up a HTTP server.
  constructor: (@port = 8911) ->
    @callback = () -> null
    @createApp()

  # Opens the test URL in a browser.
  openBrowser: (url) ->
    open @testUrl()

  # The URL that should be used to start the tests.
  testUrl: ->
    "https://localhost:#{@port}/test/html/browser_test.html"

  # The server code.
  createApp: ->
    @app = express()
    @app.get '/diediedie', (request, response) =>
      process.exit 0

    @app.use express.static(fs.realpathSync(__dirname + '/../../'),
                            { hidden: true })
    options = key: fs.readFileSync 'test/ssl/cert.pem'
    options.cert = options.key
    server = https.createServer(options, @app)
    server.listen @port

module.exports = new WebFileServer

