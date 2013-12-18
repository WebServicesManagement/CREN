console.log('JOB STARTED');

//http request object
var http = require('http');

//file system object
var fs = require('fs');

//xml parser
var xml2js = require('xml2js');

//string converter
var StringDecoder = require('string_decoder').StringDecoder;
var decoder = new StringDecoder('utf8');

//csv utility
var csv = require('csv');

//CREN credentials
var USERNAME = "lynxgeo";
var PASSWORD = "mapperjm";
var validAgentTypes = ["26","36","41","51","56","66","86","96","102","121","110","111"];

//Store current date
var currentTime = new Date();
var month = currentTime.getMonth() + 1;
var day = currentTime.getDate();
var year = currentTime.getFullYear();
var todaysDate = month + "/" + day + "/" + year;

//email credentials for sending confirmation email
var email   = require("emailjs/email");
var server  = email.server.connect({
   user:    "sysadmin@webservicesmanagement.com", 
   password:"90p3rc3nt", 
   host:    "smtp.gmail.com", 
   ssl:     true

});
//email response
var emailStr = '';

//arrays of agents not found in search
var appraisers = new Array();
var appraisersWithNoMatch = new Array();

//options for logging into CREN server
var options = {
  hostname: 'cren.rets.fnismls.com',
  path: '/rets/fnisrets.aspx/CREN/login?rets-version=rets/1.7.2',
  port: 80,
  method: 'GET',
  headers: {
     'Authorization': 'Basic ' + new Buffer(USERNAME + ':' + PASSWORD).toString('base64'),
     'User-Agent': 'WSM-CRENdata'
   }
};

//perform login
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

/**
 * Get list of agents from CREN
 */
function getCRENAgents() {
	var crenAgents;
	
	//settings for getting agents
	var options = {
	  hostname: 'cren.rets.fnismls.com',
	  //  path: '/rets/fnisrets.aspx/CREN/GetMetadata?rets-version=rets/1.7.2&Format=COMPACT&Type=METADATA-SYSTEM&ID=*',
	  path: '/rets/fnisrets.aspx/CREN/search?rets-version=rets/1.7.2&Format=COMPACT&QueryType=DMQL2&SearchType=ActiveAgent&class=ActiveAgent&StandardNames=0&Query=(U_Status=*)&Select=U_AgentLicenseID,U_Status,U_UserFirstName,U_UserLastName,AO_OrganizationName,U_PhoneNumber1,U_HiddenUsCID&Limit=NONE&ID=*',
	  port: 80,
	  method: 'GET',
	  headers: {
		 'Authorization': 'Basic ' + new Buffer(USERNAME + ':' + PASSWORD).toString('base64'),
		 'User-Agent': 'WSMCRENdata/1.0',
		 'Content-Type': 'text/xml',
		 'RETS-Version': 'RETS/1.7.2',
		 'Cookie' : cookies
	   }
	};
	
	var resData = '';
	var parser = new xml2js.Parser();
	
	//get agents list
	var req = http.request(options, function(res) {
		console.log('LOADING CREN Agents...');
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			resData += chunk;
		});
		res.on('end', function () {
			//parse xml
			parser.parseString(resData, function (err, result) {
				crenAgents = result.RETS.DATA;
				console.log('CREN Agents Loaded. '+crenAgents.length);
			});
			
			//load REB agents
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

/**
 * retrieve REB agents from REB spread sheet on drop box
 *
 * @param crenAgents  array of agents retrieved from CREN
 */
function getActiveREBs(crenAgents){
	var	rebAgents = new Array();
	
	var resData = '';
	
	//send http requet to drop box to get agents spread sheet
	http.get("http://dl.dropboxusercontent.com/s/zc9a9uncnsepdvd/Active_APPRs_PUBLIC.csv?dl=1&token_hash=AAEsmbNB4vxfrItiAKIOLXgvAxYM-4i3bbESBRFWL3lKVA", function(res) {
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
				
				//add agents to REB array
				rebAgents.push(data);
			})
			.on('end', function(count){
				console.log('REB Agents Loaded. '+count);
				
				//compare CREN array to REB array
				compareAgentLists(rebAgents,crenAgents);
				var fs = require('fs');
				
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

/**
 * compare REB and CREN arrays
 * 
 * @param rebAgents  array of REB agents
 * @param crenAgents  array of CREN agents
 */
function compareAgentLists(rebAgents,crenAgents){
	var rebAgentData;
	console.log('Starting compare... ');
	var agentsToInsert = new Array();
	exact = '';
	appraisers = '';
	foundExact = false;
	for (var j=0;j<crenAgents.length;j++)
	{
		row 			= crenAgents[j].split('\t');
		agentLicenseId	= row[1];
		agentStatus		= row[2];
		agentFirstName	= row[3];
		agentLastName	= row[4];
		agentOffice		= row[5];
		agentPhone		= row[6];
		agentAssID		= row[7];
		
		var found = false;
		var semiFound = false;
		console.log(agentAssID + ' ::: ' + validAgentTypes.indexOf(agentAssID) + ' !!! ' + validAgentTypes);
		for (var i=0;i<rebAgents.length;i++)
		{
			rebAgentData 	= rebAgents[i];
			rebLicenseId 	= rebAgentData[1];
			rebFirstName 	= rebAgentData[2];
			rebLastName 	= rebAgentData[3];
			
			
			//exact match
			if(agentLicenseId == rebLicenseId 
				&& validAgentTypes.indexOf(agentAssID.toString().trim()) != -1){
				exact += 'Appraiser License: ' 
						 + rebLicenseId + ', Name : ' + rebFirstName + ' ' 
						 + rebLastName+ ', Type : ' + agentAssID + '\n' ;
				found = true;
			}
			
		}
	
		if(!found && validAgentTypes.indexOf(agentAssID.toString().trim()) != -1){
			appraisers += 'CREN License: ' + agentLicenseId + ' != ' + rebLicenseId
						 +', Appraiser Name : ' + agentFirstName + ' ' + 
						agentLastName + ', Type : ' + agentAssID + '\n';	
		}
		foundExact = false;
	}
	
	emailStr += 'Appraisers without matching license\n';
	emailStr += appraisers;
	emailStr += '\n\nAppraisers with matching license\n';
	emailStr += exact;
	sendEmail(emailStr);
	
}

/**
 * send email of missing agents
 * 
 * @param agentCount  Integer of agents missing
 * @param message  String of the message to send
 */
function sendEmail(message){
	server.send({
	text:    message, 
	from:    "sysadmin@webservicesmanagement.com", 
	//to:      "Jeff Follis <jeff@crenmls.com>,Robin Martinez <robin@crenmls.com>", 
	cc:      "pcjones10@gmail.com",
	subject: "Appraiser file for " + todaysDate
	}, function(err, message) { console.log(err || message); });
}