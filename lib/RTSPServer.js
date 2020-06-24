const Net = require ('net')
const Url = require ('url');
const Emitter = require ('./Emitter');

const RTSPConnection = require("./RTSPConnection");

class RTSPServer extends Emitter
{
	constructor()
	{
		super ();
		//Create server socket
		this.server = new Net.Server();
		//Connections set
		this.connections = new Set();
		
		//On new connection
		this.server.on("connection",(socket)=>{
			//Create new rtsp connection
			const rtspConnection = new RTSPConnection(socket);
			
			//Add to set
			this.connections.add(rtspConnection);
			
			//Launc event
			this.emitter.emit("connection",rtspConnection);
			
			//Listen for disconnection
			rtspConnection.once("closed",()=>{
				//remove
				this.connections.delete(rtspConnection);
			});
		});
	}
	
	async listen(port)
	{
		return new Promise((resolve,reject)=>{
			//Error
			this.server.once("error",reject);
			//Listen
			this.server.listen(port,()=>{
				//Remove error listener
				this.server.removeListener("error",reject);
				//Resolve
				resolve();
			});
		});
	}
	
	async stop()
	{
		//IF closed already
		if (!this.server)
			//Done
			return null;
		
		//Stop all connection
		for (const connection of this.connections)
			//stop
			connection.close();
		
		//Get server
		const server = this.server;
		
		//Allow process to exit
		this.server.unref();
		
		//Nullify it
		this.server = null;
		
		//Close async
		return new Promise((resolve,reject)=>{
			//Error
			server.once("error",reject);
			//Listen
			server.close(()=>{
				//Remove error listener
				server.removeListener("error",reject);
				//Resolve
				resolve();
			});
		});
	}
	
};

module.exports = RTSPServer;
