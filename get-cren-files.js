/* Delta test */
var http = require('http');

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
  console.log('STATUS: ' + res.statusCode);
  console.log('HEADERS: ' + JSON.stringify(res.headers));
  cookies = res.headers['set-cookie'];
  console.log('COOKIES: ' + cookies);
  res.setEncoding('utf8');
  res.on('data', function (chunk) {
    console.log('BODY: ' + chunk);
  });
  getObject();
});

req.on('error', function(e) {
  console.log('problem with request: ' + e.message);
});

// write data to request body
req.write('data\n');
req.end();

//my $search = "http://cren.rets.fnismls.com/rets/fnisrets.aspx/CREN/".$options{"command"}."?rets-version=".$options{"version"}."&Format=".$options{"Format"}."&Type=".$options{"Type"}."&ID=".$options{"ID"}."";
/** NOW GET THE METADATA **/
function getObject() {
  var options = {
	  hostname: 'cren.rets.fnismls.com',
	  //path: '/rets/fnisrets.aspx/CREN/getobject?rets-version=rets/1.7.2&Format=COMPACT&Resource=Property&Type=Thumbnail&ID=671077',
	  path: '/rets/fnisrets.aspx/CREN/GetMetadata?rets-version=rets/1.7.2&Format=COMPACT&Type=METADATA-SYSTEM&ID=*',
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
	
	var req = http.request(options, function(res) {
	  console.log('STATUS: ' + res.statusCode);
	  console.log('HEADERS: ' + JSON.stringify(res.headers));
	  res.setEncoding('utf8');
	  res.on('data', function (chunk) {
		console.log('BODY: ' + chunk);
	  });
	});
	
	req.on('error', function(e) {
	  console.log('problem with request: ' + e.message);
	});
	
	// write data to request body
	req.write('data\n');
	req.end();
}
/*

>> Get select fields from certain Entries in the Active_Agent Table <<
curl                                         \
        --digest                                \
        --user-agent "MyCurlClient/1.0"         \
        -o "./agents.xml"                    \
        --show-error                            \
        --dump-header ./headers.txt          \
        -u "lynxgeo:mapperjm"                         \
        --header "RETS-Version: RETS/1.7.2"     \
        --cookie-jar ./cookies.txt           \
        --cookie ./cookies.txt               \
        --data Format=COMPACT\
        --data SearchType=ActiveAgent        \
       --data Class=ActiveAgent \
          --data StandardNames=0   \
       --data QueryType=DMQL2  \
       --data Count=1  \
          --data Select="U_AgentID,U_Status,U_UserFirstName,U_UserLastName"  \
    --data Query="(U_Status=M,S)"   \
          --data Limit=NONE \
          "http://cren.rets.fnismls.com/rets/fnisrets.aspx/CREN/search"


>> Get Thumbnail for MLS 666544 <<
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
          "http://cren.rets.fnismls.com/rets/fnisrets.aspx/CREN/getobject"

*/
