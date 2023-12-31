const path = require('path');
const storage = require('node-persist');
const chokidar = require('chokidar');


export namespace DataExchangeNs
{
	/**
	 * @abstract This class supports the data exchange between the Plugin and the MarkdownIt script
	 * 
	 * It does this by using two mechanisms:
	 * - a persistent storage to exchange the data
	 * - a file system watcher for detection of changes
	 * 
	 */
	export class DataExchange
	{
		/**
		 * @abstract Constructor (private) will never be invoked directly by clients
		 * 
		 */
		private constructor(pluginId: string, dataPath: string)
		{
			this.pluginId = pluginId;
			this.dataPath = dataPath;
			this.prepareStorage();
		}
		
		/**
		 * @abstract Instatiates the class from Script
		 * 
		 */
		public static fromScript(pluginId: string, dataPath: string, signalListener: Function) : DataExchange
		{
			let dataExchange = new DataExchange(pluginId, dataPath);
			
			dataExchange.signalListener = signalListener; 								// only needed in Script
			dataExchange.prepareWatcher();
			
			return dataExchange;
		}
		
		/**
		 * @abstract Instatiates the class from Plugin
		 * 
		 */
		public static fromPlugin(pluginId: string, dataPath: string, supportedSettings: [string])
		{
			let dataExchange = new DataExchange(pluginId, dataPath);
			
			dataExchange.supported = supportedSettings;									// only needed in Plugin 
			
			return dataExchange;
		}

		/**
		 * @abstract Writes settings to persisted storage, meant for data exchange with the 
		 * 			 MarkdownIt script. Invoked by Plugin onChanged - handler.
		 */
		public ChangeSetting(key: string, val: any) : void
		{
			if (this.supported.includes(key))
			{
				this.storage.setItemSync(key, val);	
			}
		}
		
		/**
		 * @abstract Prepares the storage
		 */
		prepareStorage() : void
		{
			this.storage = storage.create();
			this.storage.initSync({ dir: this.dataPath });
		}
		
		/**
		 * @abstract Watch storage directory
		 */ 
		prepareWatcher() : void
		{
			this.watchPath = path.join(this.dataPath, '*');
			this.watcher = chokidar.watch(this.watchPath, { persistent: true })
			this.watcher.on('all', (event: string, path: any) => 
			{
			  	console.info(`${this.pluginId} : Signal arrived : ${event}, ${path}`);
			  	const signal = this.storage.getItemSync('signal');
			  	this.signalListener(signal);
			});			
		}
		
		pluginId: string = '';
		dataPath: string;
		watchPath: string;
		signalListener: Function;
		storage: any;
		watcher: any;
		supported: [string];
	}
}
