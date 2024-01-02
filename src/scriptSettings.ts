import { DataExchangeNs } from './dataExchange';
const EventEmitter = require('events');


/**
 * @abstract Settings for the Script side of the plugin
 * 
 */
export class Settings
{
	constructor(pluginOptions: any, signalListener: Function)
	{
		this.pluginOptions = pluginOptions;
		this.signalListener = signalListener;
		this.prepare();
	}
	
	/**
	 * @abstract Prepares the script side of the Settings
	 *  
	 */
	prepare() : void
	{
		this.eventEmitter = new EventEmitter();
		this.eventEmitter.on('activate_attributes', this.signalListener);
		const dataDir = this.dataDirSync();
		const pluginId = this.pluginIdSync();
		this.dataExchange = DataExchangeNs.DataExchange.fromScript(pluginId, dataDir, (event: any) => 
		{
			for (const key of event.keys)
			{
				console.log(`${pluginId} : Changed settings : ${event.keys}, ${key}`);
				const val = this.pluginOptions.settingValue(key);
				this.eventEmitter.emit(key, val);
			}
		});
	}
	
	/**
	 * @abstract Retrieves the activate_attributes setting on the script side 
	 */
	activateAttributesSync() : Boolean
	{
		return this.pluginOptions.settingValue('activate_attributes');
	}
	
	/**
	 * @abstract Retrieves the plugin_id setting on the script side 
	 */
	pluginIdSync() : string
	{
		return this.pluginOptions.settingValue('plugin_id');
	}
	
	/**
	 * @abstract Retrieves the data_dir setting on the script side 
	 */
	dataDirSync() : string
	{
		return this.pluginOptions.settingValue('data_dir');
	}
	
	/**
	 * @abstract Retrieves the resource_dir setting on the script side 
	 */
	resourceDirSync() : string
	{
		return this.pluginOptions.settingValue('resource_dir');
	}
	
	
	pluginOptions: any;
	dataExchange: DataExchangeNs.DataExchange;
	eventEmitter: any;
	signalListener: Function;
}
