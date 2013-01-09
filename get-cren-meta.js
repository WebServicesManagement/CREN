var http = require('http');
var username = "lynxgeo";
var password = "mapperjm";

var options = {
  hostname: 'cren.rets.fnismls.com',
  path: '/rets/fnisrets.aspx/CREN/login?rets-version=rets/1.7.2',
  port: 80,
  method: 'GET',
  headers: {
     'Authorization': 'Basic ' + new Buffer(username + ':' + password).toString('base64'),
     'User-Agent': 'WSM-CRENdata'
   }
};

var cookies;
var req = http.request(options, function(res) {
	cookies = res.headers['set-cookie'];
	res.setEncoding('utf8');
	res.on('end', function(e) {

		var options = {
		  hostname: 'cren.rets.fnismls.com',
		  path: '/rets/fnisrets.aspx/CREN/GetMetadata?rets-version=rets/1.7.2&Format=COMPACT&Type=METADATA-SYSTEM&ID=*',
		  //path: '/rets/fnisrets.aspx/CREN/search?rets-version=rets/1.7.2&Format=COMPACT&QueryType=DMQL2&SearchType=ActiveAgent&class=ActiveAgent&StandardNames=0&Query=(U_Status=M,S)&Select=U_AgentID,U_Status,U_UserFirstName,U_UserLastName,AO_OrganizationName&Limit=NONE&ID=*',
		  port: 80,
		  method: 'GET',
		  headers: {
			 'Authorization': 'Basic ' + new Buffer(username + ':' + password).toString('base64'),
			 'User-Agent': 'WSMCRENdata/1.0',
			 'Content-Type': 'text/xml',
			 'RETS-Version': 'RETS/1.7.2',
			 'Cookie' : cookies
		   }
		};
		
		var resData = '';
		var req = http.request(options, function(res) {
			console.log('LOADING CREN Agents...');
			res.setEncoding('utf8');
			res.on('data', function (chunk) {
				resData += chunk;
			});
			res.on('end', function () {  
				var fs = require('fs');
				fs.writeFile('CRENmeta.cvs', resData, function (err) {
					if (err) throw err;
					console.log('It\'s saved!');
				});
			});
		});
	});
});