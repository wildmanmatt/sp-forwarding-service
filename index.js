'use strict';

let q = require('q')
  , express = require('express')
  , app = express()
  , bodyParser = require('body-parser')
  , request = require('request')
  , getBaseRequest = request.defaults({
    baseUrl: process.env.SPARKPOST_API_URL,
    headers: { 'Authorization': process.env.SPARKPOST_API_KEY }
  })
  , postBaseRequest = getBaseRequest.defaults({
    headers: { 'Content-Type': 'application/json' }
  })
  , client = require('redis').createClient(process.env.REDIS_URL)
  , appUrl
  , hasWebhook = false;

if (process.env.SPARKPOST_API_URL === null) {
  console.error('SPARKPOST_API_URL must be set');
  process.exit(1);
}

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

app.use(express.static(__dirname + '/public'));

app.use(bodyParser.json());

app.get('/setup', function(request, response) {

  // Use the requesting hostname to build the URL that will later be used to add
  // the relay webhook
  appUrl = 'https://' + request.hostname + '/message';

  client.set('appUrl', appUrl, function(err) {
    if (err) {
      response.status(500).send('Redis error: ' + err);
    } else {
      response.status(200).send('<p>App URL set to ' + appUrl + '</p>');
    }
  });
});

// Responds with a JSON object containing the configured inbound domain, and a
// flag indicating whether it has been set up in SparkPost.
app.get('/inbound-domain', function(request, response) {
  getInboundDomains()
    .fail(function(msg) {
      return response.status(500).send(msg);
    })
    .done(function(domains) {
      return response.status(200).json({
        domain: process.env.INBOUND_DOMAIN,
        in_sparkpost: (domains.indexOf(process.env.INBOUND_DOMAIN) >= 0)
      });
    });
});

app.post('/inbound-domain', function(request, response) {
  try {
    let data = JSON.parse(JSON.stringify(request.body));

////////////////////////////////////////////////////////////////////////////////
    console.log('id', data); // Why is this empty?
////////////////////////////////////////////////////////////////////////////////

    // addInboundDomain(data);
    response.status(200).send('OK');
  } catch (e) {
    console.error('Invalid data', e);
    response.status(400).send('Invalid data');
  }
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
          reject(error);
        } else {
          reject(response.statusCode + ' ' + body);
        }
      }
    });
  });
}

function addInboundDomain(domain) {
  return q.Promise(function(resolve, reject) {
    postBaseRequest.post({
      url: 'inbound-domains',
      json: {
        domain: domain
      }
    }, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        console.log('Inbound domain ' + domain + ' created');
        resolve();
      } else {
        reject(response.statusCode + ' ' + JSON.stringify(body));
      }
    });
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

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
