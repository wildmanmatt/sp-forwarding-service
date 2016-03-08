# SparkPost Forwarding Service

A small Heroku service that will consume inbound message webhook POSTs and
forward them through the Transmissions API to a mailbox.

## How to set up the service

1.  Register for an account with [Heroku][1] and install the Heroku
    [Toolbelt][2] for your operating system. Then log in:

        heroku login

2.  Clone the repository and install:

        git clone git@github.com:SparkPost/sp-forwarding-service.git
        cd sp-forwarding-service
        npm install

3.  Create the heroku app:

        heroku create

4.  Configure the app:

        heroku config:set SPARKPOST_API_KEY=<your-api-key-here>
        heroku config:set INBOUND_DOMAIN=<your-inbound-domain-here>
        heroku config:set FORWARD_FROM=<the-from-address-to-use>
        heroku config:set FORWARD_TO=<the-recipient-of--forward-messages>

        The INBOUND_DOMAIN should be a domain that you own and have set up in
        DNS so that its MX records point to rx1.sparkpostmail.com,
        rx2.sparkpostmail.com, and rx3.sparkpostmail.com.

5.  Deploy the app:

        git push heroku master


[1]: https://signup.heroku.com
[2]: https://toolbelt.heroku.com
