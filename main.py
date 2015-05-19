#!/usr/bin/env python
#
# Copyright 2007 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
import os, webapp2, jinja2
from webapp2_extras import routes
import argparse
import json
import pprint
import sys
import urllib
import urllib2
import logging

from google.appengine.ext import vendor
vendor.add('lib')

import oauth2

template_dir = os.path.dirname(__file__)
jinja_env = jinja2.Environment(loader = jinja2.FileSystemLoader(template_dir),
								autoescape = True)

keys = {}

class Credentials(object):
    """Creates credential object from config.json file to be used in querying servers
    """
    def __init__(self):
        with open('config.json') as config:
            self.credentials = json.load(config)

    def create(self):
        return self.credentials

# Intializes credential object for global access
cred = Credentials()

""" Take in url_params. If querying just business, url_params
should have a 'business' key value, otherwise it will not
and query should default to using 'term'."""


class Yelp(object):

    def __init__(self):
        """Initiates the url parameters and OAuth Credentials to query the Yelp API.
        """
        self.API_HOST = 'api.yelp.com'
        self.SEARCH_PATH = '/v2/search/'
        self.BUSINESS_PATH = '/v2/business/'

        keys = cred.create()["yelp"]

        self.SECURE = SecReq({
            "CONSUMER_KEY" : keys["CONSUMER_KEY"].encode("ascii"),
            "CONSUMER_SECRET" : keys["CONSUMER_SECRET"].encode("ascii"),
            "TOKEN" : keys["TOKEN"].encode("ascii"),
            "TOKEN_SECRET" : keys["TOKEN_SECRET"].encode("ascii")
            })

    def query(self, url_params):
        """Main function of Yelp instance. Call to obtain results

        Args:
            url_params (str): The url parameters passed in pre-formatted from AJAX call
        """

        try:
            return self.query_api(url_params)
        except urllib2.HTTPError as error:
            sys.exit('Encountered HTTP error {0}. Abort program.'.format(error.code))

    def get_business(self, business_id):
        """Query the Business API by a business ID.

        Args:
            business_id (str): The ID of the business to query.

        Returns:
            dict: The JSON response from the request.
        """
        business_path = self.BUSINESS_PATH + business_id

        return self.SECURE.request(self.API_HOST, business_path)

    def query_api(self, url_params):
        """Queries the API by the input values from the user.

        Args:
            url_params (str): The url parameters passed in pre-formatted to the API
        """


        response = self.search(url_params)

        businesses = response.get('businesses')

        business_id = businesses[0]['id']

        response = []

        for i in businesses:
            response.append(self.get_business(i['id']))

        return response

    def search(self, url_params):
        """Query the Search API by a search term and location.

        Args:
            url_params (str): The url parameters passed in pre-formatted to the API.

        Returns:
            dict: The JSON response from the request.
        """

        return self.SECURE.request(self.API_HOST, self.SEARCH_PATH, url_params=url_params)

class SecReq(object):

    def __init__(self, credentials):
        """Initializes credentials for secure request object

        Args:
            key value pairs for 'CONSUMER_KEY', 'CONSUMER_SECRET', 'TOKEN',
            and 'TOKEN_SECRET'
        """

        self.CONSUMER_KEY = credentials["CONSUMER_KEY"]
        self.CONSUMER_SECRET = credentials["CONSUMER_SECRET"]
        self.TOKEN = credentials["TOKEN"]
        self.TOKEN_SECRET = credentials["TOKEN_SECRET"]

    def request(self, host, path, url_params=None):
        """Prepares OAuth authentication and sends the request to the API.

        Args:
            host (str): The domain host of the API.
            path (str): The path of the API after the domain.
            url_params (dict): An optional set of query parameters in the request.

        Returns:
            dict: The JSON response from the request.

        Raises:
            urllib2.HTTPError: An error occurs from the HTTP request.
        """
        url_params = url_params or {}
        url = 'http://{0}{1}?'.format(host, urllib.quote(path.encode('utf8')))

        consumer = oauth2.Consumer(self.CONSUMER_KEY, self.CONSUMER_SECRET)
        oauth_request = oauth2.Request(method="GET", url=url, parameters=url_params)

        oauth_request.update(
            {
                'oauth_nonce': oauth2.generate_nonce(),
                'oauth_timestamp': oauth2.generate_timestamp(),
                'oauth_token': self.TOKEN,
                'oauth_consumer_key': self.CONSUMER_KEY
            }
        )
        token = oauth2.Token(self.TOKEN, self.TOKEN_SECRET)
        oauth_request.sign_request(oauth2.SignatureMethod_HMAC_SHA1(), consumer, token)
        signed_url = oauth_request.to_url()

        print u'Querying {0} ...'.format(url)

        conn = urllib2.urlopen(signed_url, None)
        try:
            response = json.loads(conn.read())
        finally:
            conn.close()

        return response


# HANDLERS
class Handler(webapp2.RequestHandler):

    def get(self, html):
        html = '.html'
    	try:
    		x = jinja_env.get_template(html)
    	except:
    		# change to redirect for url/uri match
            x = jinja_env.get_template("index.html")

    	self.response.out.write(x.render())

    def post(self, html):
        pass

class Proxy(Handler):
    """Proxy handler to direct API request to target url and return
    the response. Requires use of GET method

    """

    def get(self):
        url_params = {}
        array = self.request.GET.items()
        for i in array:
            url_params[i[0].encode('ascii')] = i[1].encode('ascii')
        response = Yelp()
        self.response.write(json.dumps(response.query(url_params)))


def handle_404(request, response, exception):
    logging.exception(exception)
    response.write('Oops! (This is a 404)')
    response.set_status(404)

app = webapp2.WSGIApplication([
    webapp2.Route(r'/yelp', handler=Proxy, name='proxyHandler'),
    webapp2.Route(r'/<html:(build/html/)?\w*-?(\w*)?><:(\.html$)?>', handler=Handler, name='html')
], debug=True, )

app.error_handlers[404] = handle_404


