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
  });

if (process.env.SPARKPOST_API_URL === null) {
  console.error('SPARKPOST_API_URL must be set');
  process.exit(1);
}

if (process.env.SPARKPOST_API_KEY === null) {
  console.error('SPARKPOST_API_KEY must be set');
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

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

app.use(bodyParser.json());

app.get('/inbound-webhook', function(request, response) {
  let appUrl = 'https://' + request.hostname + '/message';
  getInboundWebhooks()
    .then(function(webhooks) {
      let domain = null;
      for (var i in webhooks) {
        if (webhooks[i].target === appUrl) {
          domain = webhooks[i].match.domain;
          break;
        }
      }
      if (domain == null) {
        return response.sendStatus(404);
      }
      return response.status(200).json({app_url: appUrl, domain: domain });
    })
    .fail(function(msg) {
      return response.status(500).json({error: msg});
    });
});

app.post('/inbound-webhook', function(request, response) {
  try {
    let data = JSON.parse(JSON.stringify(request.body));
    var domain = data.domain;
  } catch (e) {
    return response.status(400).json({err: 'Invalid data'});
  }

  let appUrl = 'https://' + request.hostname + '/message';
  addInboundWebhook(appUrl, domain)
    .then(function() {
      return response.status(200).json({app_url: appUrl});
    })
    .fail(function(msg) {
      return response.status(500).json({error: msg});
    });
});

app.post('/inbound-domain', function(request, response) {
  try {
    let data = JSON.parse(JSON.stringify(request.body));
    var domain = data.domain;
  } catch (e) {
    return response.status(400).json({err: 'Invalid data'});
  }

  addInboundDomain(domain)
    .then(function() {
      return response.status(200).json({domain: domain});
    })
    .fail(function(msg) {
      return response.status(500).send(msg);
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
        return response.status(200).send('OK');
      } else {
        console.error('Transmission failed: ' + res.statusCode + ' ' + JSON.stringify(body));
        return response.status(500).send('Transmission failed: ' + JSON.stringify(body));
      }
    });
  } catch (e) {
    return response.status(400).send('Invalid data');
  }
});

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

function addInboundWebhook(appUrl, domain) {
  return q.Promise(function(resolve, reject) {
    postBaseRequest.post({
      url: 'relay-webhooks',
      json: {
        name: 'Forwarding Service',
        target: appUrl,
        auth_token: '1234567890qwertyuio', // TODO do this properly
        match: {
          protocol: 'SMTP',
          domain: domain
        }
      }
    }, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        console.log('Inbound webhook created');
        resolve();
      } else {
        reject(response.statusCode + ' ' + JSON.stringify(body));
      }
    });
  });
}

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
