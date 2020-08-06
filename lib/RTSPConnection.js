
const Net = require ('net')
const Url = require ('url');
const httpZ = require ('./http-z');
const WWWAuthenticate = require('www-authenticate');
const Emitter = require ('./Emitter');



class RTSPConnection extends Emitter
{
	constructor(socket)
	{
		super ();
	
		//Store socket
		this.socket = socket;
		
		//No delay
		this.socket.setNoDelay(true);
		
		//No pending message
		this.pending = "";
		
		//listen for events
		this.socket
			.on("close",()=>{
				//Close
				this.close();
			})
			.on("timeout",()=>{
				//Emit timeout
				this.emitter.emit("timeout",this);
			})
			.on("data",(chunk)=>{
				//Add to pending
				this.pending += chunk;
				console.log(this.pending);
				try {
					//try to parse rtsp request
					const request = httpZ.parse(this.pending);
					
					//If not ok
					if (!request)
						//Skip
						return;
					
					//Remove data from the request to the pending data
					this.pending = this.pending.slice(request.messageSize);
						
					//Get Cseq headers
					const cseqs = request.headers.find(header=>header.name.toLowerCase()=="cseq");
						
					//Try vlaue from headers 
					const cseq = cseqs.values[0].value;

					//Check
					if (!cseq)
						return console.error("cseq not found");
					
					//Get session header
					const session = request.headers.find(header=>header.name=="Session");
					
					//Get session id
					const sessionId = session && session.values && session.values[0] && session.values[0].value ? session.values[0].value.split(";")[0] : undefined;
					
					//Create new transaction
					const transaction = {
						cseq		: cseq,
						sessionId	: sessionId,
						request		: request,
						response	: (statusCode,statusMessage,headers,body)=>{
							try {
								//Create request
								const response = {
									statusCode	: statusCode,
									statusMessage	: statusMessage,
									protocol	: 'RTSP',
									protocolVersion	: 'RTSP/1.0',
									params		: {p1: 'v1'},
									headers: [
										{ name : "CSeq"		, values : [{value: cseq}]},
										{ name : "User-Agent"	, values : [{value: "medooze-rtsp-server"}]}
									]
								};
								
								//Add headers
								for (const[key,val] of Object.entries(headers || {}))
									//Push it
									response.headers.push({
										name	: key,
										values	: [{value: val}]
									});
								//If We have been authenticated
								if (this.authenticated)
									//Push header
									response.headers.push({
										name	: "Authorization",
										values	: [{value: this.authenticated.authorize(request.method,this.url.href)}]
									});
								
								//If it has body
								if (body)
								{
									//Add length
									response.headers.push({
										name	: "Content-Length",
										values	: [{value: body.length}]
									});
									//And bofy
									response.body ={plain: body};
								}

								//Serialize
								const str = httpZ.build(response);
								
								console.log("res: "+ str);
								//Serialize and send
								this.socket.write(str);
							} catch (e) {
								console.error(e);
							}
						}
					};
					
					//Emit
					this.emitter.emit("request",transaction);
				} catch(e) {
					console.error(e);
				}
			});
	}
	
	getLocalAddress()
	{
		return this.socket.address().address!="::1" ? this.socket.address().address.replace("::ffff:","") : "127.0.0.1";
	}
	
	getRemoteAddress()
	{
		return this.socket.remoteAddress!="::1" ? this.socket.remoteAddress.replace("::ffff:","") : "127.0.0.1";
	}
	setTimeout(ms)
	{
		return this.socket.setTimeout(ms);
	}
	
	close()
	{
		//Check socket
		if (!this.socket)
			//Done
			return;
		
		//Stop socket
		this.socket.end();
		this.socket.destroy();
		
		//Emit event
		this.emitter.emit("closed",this);
		
		//null stuff
		this.socket = null;
	}
	
};


module.exports = RTSPConnection;
