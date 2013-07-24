console.log('JOB STARTED');
var http = require('http');
var fs = require('fs');
var xml2js = require('xml2js');
var StringDecoder = require('string_decoder').StringDecoder;
var decoder = new StringDecoder('utf8');
var csv = require('csv');

var cradle = require('cradle');
var c = new(cradle.Connection);
var db = c.database('cren');
db.create();
 
var username = "lynxgeo";
var password = "mapperjm";

var currentTime = new Date();
var month = currentTime.getMonth() + 1;
var day = currentTime.getDate();
var year = currentTime.getFullYear();
var todaysDate = month + "/" + day + "/" + year;

var email   = require("emailjs/email");
var server  = email.server.connect({
   user:    "sysadmin@webservicesmanagement.com", 
   password:"90p3rc3nt", 
   host:    "smtp.gmail.com", 
   ssl:     true

});
var emailStr = 'Agents not found in REB file:\n';
var invalidAgents = new Array();
var semiInvalidAgents = new Array();
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
	req.on('error', function (err) {
		console.log(err);
	});
});

req.end();

function getCRENAgents() {
	var crenAgents;
	
	var options = {
	  hostname: 'cren.rets.fnismls.com',
	  //  path: '/rets/fnisrets.aspx/CREN/GetMetadata?rets-version=rets/1.7.2&Format=COMPACT&Type=METADATA-SYSTEM&ID=*',
	  path: '/rets/fnisrets.aspx/CREN/search?rets-version=rets/1.7.2&Format=COMPACT&QueryType=DMQL2&SearchType=ActiveAgent&class=ActiveAgent&StandardNames=0&Query=(U_Status=M,S)&Select=U_AgentLicenseID,U_Status,U_UserFirstName,U_UserLastName,AO_OrganizationName,U_PhoneNumber1&Limit=NONE&ID=*',
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
			parser.parseString(resData, function (err, result) {
				crenAgents = result.RETS.DATA;
				console.log('CREN Agents Loaded. '+crenAgents.length);
			});
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

function getActiveREBs(crenAgents){
	var	rebAgents = new Array();
	
	var resData = '';
	http.get("http://dl.dropboxusercontent.com/s/xqk6hdcgy0403p0/Active_REBs_PUBLIC.csv.csv?dl=1", function(res) {
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
				console.log(data);
				rebAgents.push(data);
			})
			.on('end', function(count){
				console.log('REB Agents Loaded. '+count);
				compareAgentLists(rebAgents,crenAgents);
				var fs = require('fs');
				fs.writeFile('CRENagents.cvs', crenAgents.join("\n"), function (err) {
					if (err) throw err;
					console.log('It\'s saved!');
				});
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

function compareAgentLists(rebAgents,crenAgents){
	var rebAgentData;
	console.log('Starting compare... ');
	var agentsToInsert = new Array();

	for (var j=0;j<crenAgents.length;j++)
	{
		row 			= crenAgents[j].split('\t');
		agentLicenseId	= row[1];
		agentStatus		= row[2];
		agentFirstName	= row[3];
		agentLastName	= row[4];
		agentOffice		= row[5];
		agentPhone		= row[6];
		
		var found = false;
		for (var i=0;i<rebAgents.length;i++)
		{
			rebAgentData 	= rebAgents[i];
			rebFirstName 	= rebAgentData[1];
			rebLastName 	= rebAgentData[2];
			rebOffice 		= rebAgentData[3];
			rebPhone 		= rebAgentData[9];
			rebLicenseId 	= rebAgentData[10];
			
			if(agentLicenseId == rebLicenseId){
				found = true;
				break;
				
			}
			
			if(rebLastName.toLowerCase().replace(/[^\w\s]/gi, '') == agentLastName.toLowerCase().replace(/[^\w\s]/gi, '')
				&& 
				((rebOffice.toLowerCase().replace(/[^\w\s]/gi, '') == agentOffice.toLowerCase().replace(/[^\w\s]/gi, '')
				||
				rebFirstName.toLowerCase().replace(/[^\w\s]/gi, '').indexOf(agentFirstName.toLowerCase().replace(/[^\w\s]/gi, '').substring(0,2)) != -1)
				||
				rebPhone.indexOf(agentPhone) != -1)
				){
					if(semiInvalidAgents[semiInvalidAgents.length - 1] === "undefined" || semiInvalidAgents.length == 0){
						semiInvalidAgents.push('CREN DATA: Name = ' + agentFirstName.toUpperCase() + 
												' ' + agentLastName.toUpperCase() + 
												' Office = ' + agentOffice.toUpperCase() + 
												' Phone = ' + agentPhone.toUpperCase() + 
												' License = ' + agentLicenseId.toUpperCase() + 
												'\nREB DATA: Name = ' + rebFirstName + 
												' ' + rebLastName.toUpperCase() + 
												' Office = ' + rebOffice.toUpperCase() + 
												' Phone = ' + rebPhone.toUpperCase() + 
												' License =' + rebLicenseId + '\n');
					}else if(semiInvalidAgents[semiInvalidAgents.length - 1].indexOf(agentLicenseId) != -1){
						semiInvalidAgents[semiInvalidAgents.length] += '\nREB DATA: Name = ' + rebFirstName + 
												' ' + rebLastName.toUpperCase() + 
												' Office = ' + rebOffice.toUpperCase() + 
												' Phone = ' + rebPhone.toUpperCase() + 
												' License =' + rebLicenseId + '\n';
					
					}
					found = true;
			}
		}
		
		if(!found){
			invalidAgents.push(agentFirstName.toUpperCase() + ' ' + agentLastName.toUpperCase());
		}
		
		row[6] = found;
		agentsToInsert.push(row);
	}
	
	insertVerifiedAgents(agentsToInsert);
}

function insertVerifiedAgents(agentArray){
	console.log('Inserting Results...');
	var agentsToInsert = new Array();
	for (var i=0;i<agentArray.length;i++)
	{
		row 			= agentArray[i];
		agentId			= row[1];
		agentStatus		= row[2];
		agentFirstName	= row[3].toUpperCase();
		agentLastName	= row[4].toUpperCase();
		agentOffice		= row[5];
		verified		= row[6];
		agentsToInsert.push({
			_id				: agentId,
			AgentLastName	: agentLastName,
			AgentFirstName	: agentFirstName,
			AgentOffice		: agentOffice,
			CreatedDate		: todaysDate,
			verified		: verified
		});
	}
	db.save(agentsToInsert, function (err, res) {
		createViews();
	}); 
}

function createViews(){
	console.log('Creating and Sending Email...');
	db.save('_design/agent', {
		views: {
			verified: {
				map: "function (doc) {if(doc.verified && doc.CreatedDate == '" + todaysDate + "'){emit(doc.AgentFirstName + ' ' + doc.AgentLastName , doc)}}"
			},
			unverified: {
				map: "function (doc) {if(!doc.verified && doc.CreatedDate == '" + todaysDate + "'){emit(doc.AgentFirstName + ' ' + doc.AgentLastName , doc)}}"
			}
		}
	}, function(err,res){
		var req = http.get('http://127.0.0.1:5984/cren/_design/agent/_view/unverified',function(res) {
			var response = '';
			res.on('data', function (chunk) {
				console.log('chunk:'+decoder.write(chunk));
				response += decoder.write(chunk);
			});
			res.on('end', function(e) {
				console.log('RES:'+response);
				invalidAgents.sort();
				emailStr += invalidAgents.join('\n');
				emailStr += '\n\nAgents found but with non matching license #s\n' + semiInvalidAgents.join('\n')
				if(invalidAgents.length != 0){
					sendEmail(invalidAgents.length,emailStr);
				}
			});
		});
	});
}

function sendEmail(agentCount,message){
	server.send({
	text:    message, 
	from:    "sysadmin@webservicesmanagement.com", 
	to:      "Jeff Follis <jeff@crenmls.com>,Robin Martinez <robin@crenmls.com>", 
	//to:      "pcjones10@gmail.com",
	subject: agentCount + " CREN Agents not found in REB file for " + todaysDate
	}, function(err, message) { console.log(err || message); });
}

function buidlEmailMessage(jsonStr){
	emailStr += '\r\n' + convertToCSV(jsonStr);
	return emailStr;
}

function convertToCSV(objArray) {
	var array = JSON.parse(objArray);
	var agents = array.rows;
	
	var str = '';

	for (var i = 0; i < agents.length; i++) {
		var name = agents[i].key;
		console.log('Name:' + name);
		str += name + '\r\n';
	}

	return str;
}
/*
http://127.0.0.1:5984/_utils/database.html?cren/_design/agent/_view/unverified
http://127.0.0.1:5984/cren/_design/agent/_view/verified
test file
http://dl.dropbox.com/u/68198810/ActiveREBs_PUBLIC_1212.csv

new file
http://dl.dropbox.com/s/j3w7py5mosp62us/Active_REBs_PUBLIC_0113.csv
*/