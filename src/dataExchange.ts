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
			this.watchPath = path.join(dataPath, '*');
			this.prepareStorage();
		}
		
		/**
		 * @abstract Instatiates the class from Script
		 * 
		 */
		public static fromScript(pluginId: string, resourceBaseFolder: string, blockRuler: any) : DataExchange
		{
			const dataPath = path.join(resourceBaseFolder, '..', 'plugin-data', pluginId);
	
			let dataExchange = new DataExchange(pluginId, dataPath);
			
			dataExchange.blockRuler = blockRuler; 										// only needed in Script
			dataExchange.prepareWatcher();
			dataExchange.onSettingChanged();											// initial invokation
			
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
		 * 
		 */
		public async ChangeSetting(key: string, val: any) : Promise<void>
		{
			if (this.supported.includes(key))
			{
				this.storage.setItemSync(key, val);	
			}
		}
		
		/**
		 * @abstract Prepares the storage
		 * 
		 */
		prepareStorage() : void
		{
			this.storage = storage.create();
			this.storage.initSync({ dir: this.dataPath });
		}
		
		/**
		 * @abstract Watch storage directory
		 * 
		 */ 
		prepareWatcher() : void
		{
			this.watcher = chokidar.watch(this.watchPath, { persistent: true })
			this.watcher.on('all', (event: string, path: any) => 
			{
			  	console.log(`${this.pluginId} : Configuration changed : ${event}, ${path}`);
				this.onSettingChanged();
			});			
		}
		
		/**
		 * @abstract Handler of data changes monitored with watcher
		 * 
		 */
		onSettingChanged() : void
		{
			const activate_attributes = this.storage.getItemSync('activate_attributes');			  	
			console.debug(`${this.pluginId} : Read settings : ${activate_attributes}`)
			if (! activate_attributes)
			{
			  	console.debug(`${this.pluginId} : Disabled attributes`);
				this.blockRuler.disable(['attributes'], true);
			}
			else
			{
			  	console.debug(`${this.pluginId} : Enabled attributes`);
				this.blockRuler.enable(['attributes'], true);
			}
		}
		
		pluginId: string = '';
		dataPath: string;
		watchPath: string;
		blockRuler: any;
		storage: any;
		watcher: any;
		supported: [string];
	}
}
