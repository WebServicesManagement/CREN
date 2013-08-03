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
var emailStr = 'Agents not found in REB file:\n';

//arrays of agents not found in search
var invalidAgents = new Array();
var semiInvalidAgents = new Array();

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
	  path: '/rets/fnisrets.aspx/CREN/search?rets-version=rets/1.7.2&Format=COMPACT&QueryType=DMQL2&SearchType=ActiveAgent&class=ActiveAgent&StandardNames=0&Query=(U_Status=M,S)&Select=U_AgentLicenseID,U_Status,U_UserFirstName,U_UserLastName,AO_OrganizationName,U_PhoneNumber1&Limit=NONE&ID=*',
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
				
				//add agents to REB array
				rebAgents.push(data);
			})
			.on('end', function(count){
				console.log('REB Agents Loaded. '+count);
				
				//compare CREN array to REB array
				compareAgentLists(rebAgents,crenAgents);
				var fs = require('fs');
				
				//create local CREN cvs
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

	for (var j=0;j<crenAgents.length;j++)
	{
		row 			= crenAgents[j].split('\t');
		agentLicenseId	= row[1];
		agentStatus		= row[2];
		agentFirstName	= row[3];
		agentLastName	= row[4];
		agentOffice		= row[5];
		agentPhone		= row[6];
		
		//console.log('********************* NEW AGENT ***************'); 
		var found = false;
		var semiFound = false;
		for (var i=0;i<rebAgents.length;i++)
		{
			rebAgentData 	= rebAgents[i];
			rebFirstName 	= rebAgentData[1];
			rebLastName 	= rebAgentData[2];
			rebOffice 		= rebAgentData[3];
			rebPhone 		= rebAgentData[9];
			rebLicenseId 	= rebAgentData[10];
			
			//console.log(agentLicenseId + ' == ' + rebLicenseId);
			
			//if match on license then exit for loop and check next agent
			if(agentLicenseId == rebLicenseId){
				found = true;
				
				agent = '';
				
				//if found in other matches remove from list
				if(semiFound){
					agent = semiInvalidAgents.pop();
				
				}
				
				//console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@ FOUND @@@@@@@@@@@@@@@@@@@@@@@@@@@ ' + semiInvalidAgents[semiInvalidAgents.length-1]);
				//console.log(agent); 
				break;
				
			}
			
			//if no matching license but matching last name and office or first name or phone then add to potential match list
			if(rebLastName.toLowerCase().replace(/[^\w\s]/gi, '') == agentLastName.toLowerCase().replace(/[^\w\s]/gi, '')
				&& 
				((rebOffice.toLowerCase().replace(/[^\w\s]/gi, '') == agentOffice.toLowerCase().replace(/[^\w\s]/gi, '')
				||
				rebFirstName.toLowerCase().replace(/[^\w\s]/gi, '').indexOf(agentFirstName.toLowerCase().replace(/[^\w\s]/gi, '').substring(0,3)) != -1)
				||
				(rebPhone.indexOf(agentPhone) != -1 && agentPhone.length > 5))
				){
					//if first match then add new node
					if(semiFound == false){
						semiInvalidAgents.push('\nCREN DATA: Name = ' + agentFirstName.toUpperCase() + 
												' ' + agentLastName.toUpperCase() + 
												' Office = ' + agentOffice.toUpperCase() + 
												' Phone = ' + agentPhone.toUpperCase() + 
												' License = ' + agentLicenseId.toUpperCase());
												
					}
					
					semiInvalidAgents[semiInvalidAgents.length-1] += '\nREB DATA: Name = ' + rebFirstName + 
												' ' + rebLastName.toUpperCase() + 
												' Office = ' + rebOffice.toUpperCase() + 
												' Phone = ' + rebPhone.toUpperCase() + 
												' License =' + rebLicenseId;
												
					/*console.log(rebLastName.toLowerCase().replace(/[^\w\s]/gi, '') + ' == ' + agentLastName.toLowerCase().replace(/[^\w\s]/gi, '')
						+ ' && ' +
						rebOffice.toLowerCase().replace(/[^\w\s]/gi, '') + '  == ' + agentOffice.toLowerCase().replace(/[^\w\s]/gi, '')
						+ ' || '
						+ rebFirstName.toLowerCase().replace(/[^\w\s]/gi, '') + ' ' + agentFirstName.toLowerCase().replace(/[^\w\s]/gi, '').substring(0,3)
						+ ' || '
						+ rebPhone + ' :: ' + agentPhone);*/
					
					semiFound = true;
					found = true;
					
			}
			
		}
		
		// if not found add to invalid agent list
		if(!found){
			invalidAgents.push(agentFirstName.toUpperCase() + ' ' + agentLastName.toUpperCase());
		}
		
		row[6] = found;
		agentsToInsert.push(row);
	}
	
	invalidAgents.sort();
	emailStr += invalidAgents.join('\n');
	emailStr += '\n\nAgents found but with non matching license #s\n' + semiInvalidAgents.join('\n');
	
	//if invalid agents found send email
	if(invalidAgents.length != 0){
		sendEmail(invalidAgents.length,emailStr);
	}
}

/**
 * send email of missing agents
 * 
 * @param agentCount  Integer of agents missing
 * @param message  String of the message to send
 */
function sendEmail(agentCount,message){
	server.send({
	text:    message, 
	from:    "sysadmin@webservicesmanagement.com", 
	//to:      "Jeff Follis <jeff@crenmls.com>,Robin Martinez <robin@crenmls.com>", 
	cc:      "pcjones10@gmail.com,nathan@webservicesmanagement.com,sam@thewebmgr.com",
	subject: agentCount + " CREN Agents not found in REB file for " + todaysDate
	}, function(err, message) { console.log(err || message); });
}