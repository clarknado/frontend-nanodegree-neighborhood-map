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
import os, webapp2, jinja2, sample, json
from webapp2_extras import routes

import logging
#from controllers import server
#from config import config

template_dir = os.path.dirname(__file__)
jinja_env = jinja2.Environment(loader = jinja2.FileSystemLoader(template_dir),
								autoescape = True)

# HANDLERS
class Handler(webapp2.RequestHandler):
    def get(self, html):
    	#html = html + '.min.html'
        logging.exception(html)
        html = html = '.html'
    	try:
    		x = jinja_env.get_template(html)
    	except:
    		# change to redirect for url/uri match
            x = jinja_env.get_template("index.html")

    	# self.response.headers[""]
    	self.response.out.write(x.render())

    def post(self, html):
        logging.exception("HANDLER POST")

class Proxy(Handler):
    def get(self, url):
        response = sample.main()
        logging.exception(response)
        self.response.write(json.dumps(response))

def handle_404(request, response, exception):
    logging.exception(exception)
    response.write('Oops! Naughty Mr. Jiggles (This is a 404)')
    response.set_status(404)

app = webapp2.WSGIApplication([
    webapp2.Route(r'/yelp<url:.*>', handler=Proxy, name='proxyHandler'),
    webapp2.Route(r'/<html:(build/html/)?\w*-?(\w*)?><:(\.html$)?>', handler=Handler, name='html')    
], debug=True, ) #config=config.config)

app.error_handlers[404] = handle_404
