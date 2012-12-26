var http = require('http');
var fs = require('fs');
var xml2js = require('xml2js');
var cradle = require('cradle');
var c = new(cradle.Connection);
var StringDecoder = require('string_decoder').StringDecoder;
var decoder = new StringDecoder('utf8');
var csv = require('csv');
var db = c.database('cren');

db.create();
 
var username = "lynxgeo";
var password = "mapperjm";


/***** LOGIN ******/
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
		getCRENAgents();
	});
});

req.end();

function compareAgentLists(rebAgents,crenAgents){
	var rebAgentData;
	console.log('Starting compare: '+ rebAgents[1]);
	for (var i=0;i<rebAgents.length;i++)
	{
		rebAgentData 	= rebAgents[i];
		rebFirstName 	= rebAgentData[1];
		rebLastName 	= rebAgentData[2];
		rebOffice 		= rebAgentData[3];
//		console.log('SEARCHING: '+ rebLastName);
		for (var j=0;j<crenAgents.length;j++)
		{
			row 			= crenAgents[j].split('\t');
			agentId			= row[1];
			agentStatus		= row[2];
			agentFirstName	= row[3];
			agentLastName	= row[4];
			agentOffice		= row[5];
			if((rebLastName.toLowerCase().replace(/[^\w\s]/gi, '') == agentLastName.toLowerCase().replace(/[^\w\s]/gi, '')
				&& rebOffice.toLowerCase().replace(/[^\w\s]/gi, '') == agentOffice.toLowerCase().replace(/[^\w\s]/gi, ''))
			|| (rebLastName.toLowerCase().replace(/[^\w\s]/gi, '') == agentLastName.toLowerCase().replace(/[^\w\s]/gi, '')
				&& rebFirstName.toLowerCase().replace(/[^\w\s]/gi, '') == agentFirstName.toLowerCase().replace(/[^\w\s]/gi, ''))){
				insertSingleAgent(row,true);
				console.log('FOUND: '+ agentLastName);
				console.log('REB: office:'+ rebOffice + ' first:'+ rebFirstName  + ' last:'+ rebLastName );
				console.log('CREN: office:'+ agentOffice + ' first:'+ agentFirstName + ' last:'+ agentLastName);
			}
		}
	}
}

function getCRENAgents() {
	var crenAgents;
	
	var options = {
	  hostname: 'cren.rets.fnismls.com',
	  //  path: '/rets/fnisrets.aspx/CREN/GetMetadata?rets-version=rets/1.7.2&Format=COMPACT&Type=METADATA-SYSTEM&ID=*',
	  path: '/rets/fnisrets.aspx/CREN/search?rets-version=rets/1.7.2&Format=COMPACT&QueryType=DMQL2&SearchType=ActiveAgent&class=ActiveAgent&StandardNames=0&Query=(U_Status=M,S)&Select=U_AgentID,U_Status,U_UserFirstName,U_UserLastName,AO_OrganizationName&Limit=NONE&ID=*',
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
	var parser = new xml2js.Parser();
	var req = http.request(options, function(res) {
		console.log('LOADING CREN Agents...');
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			resData += chunk;
		});
		res.on('end', function () {  
			console.log('CREN Agents Loaded.');
			parser.parseString(resData, function (err, result) {
				crenAgents = result.RETS.DATA;
			});
			insertAllAgents(crenAgents);
			getActiveREBs(crenAgents);
		});
	});
	
	req.on('error', function(e) {
	  console.log('problem with request: ' + e.message);
	});
	
	// write data to request body
	req.write('data\n');
	req.end();
	return;
}

function insertSingleAgent(agentArray,verified){
	agentId			= row[1];
	agentStatus		= row[2];
	agentFirstName	= row[3];
	agentLastName	= row[4];
	agentOffice		= row[5];
	db.save(agentId, {
		AgentLastName	: agentLastName,
		AgentFirstName	: agentFirstName,
		AgentOffice		: agentOffice,
		verified		: verified
	});
}

function insertAllAgents(agentArray){
	for (var i=0;i<agentArray.length;i++)
	{
		row 			= agentArray[i].split('\t');
		agentId			= row[1];
		agentStatus		= row[2];
		agentFirstName	= row[3];
		agentLastName	= row[4];
		agentOffice		= row[5];
		db.save(agentId, {
			AgentLastName	: agentLastName,
			AgentFirstName	: agentFirstName,
			AgentOffice		: agentOffice,
			verified		: false
		});
	}
}

function getActiveREBs(crenAgents){
	var	rebAgents = new Array();
	
	var options = {
	  hostname: 'dl.dropbox.com',
	  path: '/u/68198810/ActiveREBs_PUBLIC_1212.xls?dl=1'
	};
	var resData = '';
	http.get("http://dl.dropbox.com/u/68198810/ActiveREBs_PUBLIC_1212.csv", function(res) {
		console.log('LOADING REB Agents...');
		res.on('data', function (chunk) {
			resData += decoder.write(chunk);
		});
		res.on('end', function () { 
			csv()
			.from(resData)
			.transform( function(data){
				data.unshift(data.pop());
				return data;
			})
			.on('record', function(data,index){
				rebAgents.push(data);
			})
			.on('end', function(count){
				console.log('REB Agents Loaded. '+count);
				compareAgentLists(rebAgents,crenAgents);
			})
			.on('error', function(error){
				console.log('ERR:' + error.message);
			});
		});
	}).on('error', function(e) {
	  console.log("Got error: " + e.message);
	});
	return rebAgents;
}
/*
http://dl.dropbox.com/u/68198810/ActiveREBs_PUBLIC_1212.xls

curl                                         \
        --digest  --user-agent "MyCurlClient/1.0"         \
           -o "./photo1.jpg"                    \
        --dump-header ./headers.txt          \
        -u "lynxgeo:mapperjm"                         \
        --header "RETS-Version: RETS/1.7.2"     \
        --cookie-jar ./cookies.txt           \
        --cookie ./cookies.txt               \
        --data Resource=Property         \
        --data Type=Thumbnail \
        --data ID=666544 \
          "http://cren.rets.fnismls.com/rets/fnisrets.aspx/CREN/getCRENAgents"

*/
