# SparkPost Forwarding Service

A small Heroku service that will consume inbound message webhook POSTs and
forward them through the Transmissions API to a mailbox.

## Deployment

Start by clicking on the following button:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)][deploy]

Once the deployment completes click on the "View" button under "Your app was
successfully deployed". (Alternatively browse to
`https://<your-app-name>.herokuapp.com/setup`.)

If a `FORWARD_FROM` address was chosen other than the default
`forward@sparkpostbox.com` then a sending domain will need to be
[created][createsd] and verified. To get to the SparkPost UI browse to the
"Resources" tab of the newly created app in the [Heroku Dashboard][apps], and
then click "SparkPost".

## Deploying Manually

1.  Register for an account with [Heroku][signup] and install the Heroku
    [Toolbelt][toolbelt] for your operating system. Then log in:

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

5.  Configure the required add-ons:

        heroku addons:create heroku-redis:hobby-dev

6.  Deploy the app:

        git push heroku master

7.  Complete the setup by doing an HTTP GET on the `/setup` endpoint, either
    with a browser or curl:

        curl https://<your-app-name>.herokuapp.com/setup


[deploy]: https://heroku.com/deploy?template=https://github.com/SparkPost/sp-forwarding-service
[createsd]: https://support.sparkpost.com/customer/portal/articles/1933318
[apps]: https://dashboard.heroku.com/apps
[signup]: https://signup.heroku.com
[toolbelt]: https://toolbelt.heroku.com
