'use strict';

let q = require('q')
  , express = require('express')
  , app = express()
  , bodyParser = require('body-parser')
  , request = require('request')
  , getBaseRequest = request.defaults({
    baseUrl: process.env.API_URL || 'https://api.sparkpost.com/api/v1/',
    headers: { 'Authorization': process.env.SPARKPOST_API_KEY }
  })
  , postBaseRequest = getBaseRequest.defaults({
    headers: { 'Content-Type': 'application/json' }
  })
  , client = require('redis').createClient(process.env.REDIS_URL)
  , appUrl = process.env.APP_URL
  , hasWebhook = false;

if (process.env.SPARKPOST_API_KEY === null) {
  console.error('SPARKPOST_API_KEY must be set');
  process.exit(1);
}

if (process.env.INBOUND_DOMAIN === null) {
  console.error('INBOUND_DOMAIN must be set');
  process.exit(1);
}

if (process.env.FORWARD_FROM === null) {
  console.error('FORWARD_FROM must be set');
  process.exit(1);
}

if (process.env.FORWARD_TO === null) {
  console.error('FORWARD_TO must be set');
  process.exit(1);
}

client.on('error', function(err) {
  console.error('Redis error: ' + err);
});

app.set('port', (process.env.PORT || 5000));

app.use(bodyParser.json());

app.get('/setup', function(request, response) {
  // When deployed using the Heroku button the APP_URL config var will not be
  // set but this endpoint will be hit if the user clicks the "View" button
  // after deployment. Take this opportunity to set appUrl.
  appUrl = 'https://' + request.hostname + '/message';

  client.set('appUrl', appUrl, function(err) {
    if (err) {
      response.status(500).send('Redis error: ' + err);
    } else {
      let msg = 'App URL set to ' + appUrl;
      console.log(msg);
      response.status(200).send('<p>' + msg + '</p>');
    }
  });
});

app.post('/message', function(request, response) {
  try {
    let data = JSON.parse(JSON.stringify(request.body))
      // The From: address needs to be changed to use a verified domain
      // Note that jshint fails here due to a bug (https://github.com/jshint/jshint/pull/2881)
      , message = data[0].msys.relay_message.content.email_rfc822
        .replace(/^From: .*$/m, 'From: ' + process.env.FORWARD_FROM);

    postBaseRequest.post({
      url: 'transmissions',
      json: {
        recipients: [{
          address: {
            email: process.env.FORWARD_TO
          }
        }],
        content: {
          email_rfc822: message
        }
      }
    }, function(error, res, body) {
      if (!error && res.statusCode === 200) {
        console.log('Transmission succeeded: ' + JSON.stringify(body));
        response.status(200).send('OK');
      } else {
        console.error('Transmission failed: ' + res.statusCode + ' ' + JSON.stringify(body));
        response.status(500).send('Transmission failed: ' + JSON.stringify(body));
      }
    });
  } catch (e) {
    console.error('Invalid data', e);
    response.status(400).send('Invalid data');
  }
});

function getConfig() {
  return q.Promise(function(resolve, reject) {
    client.get('appUrl', function(err, reply) {
      if (err) {
        reject(err);
      } else {
        if (!reply) {
          console.log('App URL not configured in Redis');
        } else {
          appUrl = reply;
          console.log('App URL is set to ' + appUrl);
        }
        resolve();
      }
    });
  });
}

function getInboundDomains() {
  return q.Promise(function(resolve, reject) {
    getBaseRequest('inbound-domains', function(error, response, body) {
      if (!error && response.statusCode === 200) {
        let domains = Array()
          , data = JSON.parse(body);
        for (var key in data.results) {
          domains.push(data.results[key].domain);
        }
        resolve(domains);
      } else {
        if (!response) {
          reject('Error: ' + error);
        } else {
          reject(response.statusCode + ' ' + body);
        }
      }
    });
  });
}

function addInboundDomain(domain_list) {
  return q.Promise(function(resolve, reject) {
    if (domain_list.indexOf(process.env.INBOUND_DOMAIN) >= 0) {
      console.log('Inbound domain ' + process.env.INBOUND_DOMAIN + ' exists');
      resolve();
    } else {
      postBaseRequest.post({
        url: 'inbound-domains',
        json: {
          domain: process.env.INBOUND_DOMAIN
        }
      }, function(error, response, body) {
        if (!error && response.statusCode === 200) {
          console.log('Inbound domain ' + process.env.INBOUND_DOMAIN + ' created');
          resolve();
        } else {
          reject(response.statusCode + ' ' + JSON.stringify(body));
        }
      });
    }
  });
}

function getInboundWebhooks() {
  return q.Promise(function(resolve, reject) {
    getBaseRequest('relay-webhooks', function(error, response, body) {
      if (!error && response.statusCode === 200) {
        resolve(JSON.parse(body).results);
      } else {
        reject(response.statusCode + ' ' + body);
      }
    });
  });
}

function addInboundWebhook(webhook_list) {
  console.log('addInboundWebhook');
  return q.Promise(function(resolve, reject) {
    if (webhook_list.length > 0) {
      // TODO check for the actual webhook in question
      console.log('Inbound webhook exists');
      resolve();
    } else if (appUrl) {
      postBaseRequest.post({
        url: 'relay-webhooks',
        json: {
          name: 'Forwarding Service',
          target: appUrl,
          auth_token: '1234567890qwertyuio', // TODO do this properly
          match: {
            protocol: 'SMTP',
            domain: process.env.INBOUND_DOMAIN
          }
        }
      }, function(error, response, body) {
        if (!error && response.statusCode === 200) {
          console.log('Inbound webhook created');
          hasWebhook = true;
          resolve();
        } else {
          reject(response.statusCode + ' ' + JSON.stringify(body));
        }
      });
    } else {
      reject('Relay webhook has not been set up. GET the /setup endpoint.');
    }
  });
}

getConfig()
  .then(getInboundDomains)
  .then(addInboundDomain)
  .then(getInboundWebhooks)
  .then(addInboundWebhook)
  .fail(function(msg) {
    console.error(msg);
  })
  .done(function() {
    app.listen(app.get('port'), function() {
      console.log('Node app is running on port', app.get('port'));
    });
  });
