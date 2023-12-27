import joplin from 'api';
import { SettingItemType, SettingItemSubType } from 'api/types';
import { DataExchangeNs } from './dataExchange';
import { CalibreServices } from './calibreServices';
const EventEmitter = require('events');


export enum MergeMode
{
	Leave,
	Merge,
	Replace
}

export enum CleanupMode
{
	Leave,
	Cleanup
}

/**
 * @abstract Supports Settings for the Calibre Import plugin.
 * 			 Attributes plugin is also supported (script side).
 */
export class Settings
{
	constructor(pluginOptions: any = null, signalListener: Function = null)
	{
		this.fullyRegistered = false;
		this.pluginOptions = pluginOptions;
		this.signalListener = signalListener;
		if (pluginOptions)
		{
			this.prepare();
		}
	}
	
	/**
	 * @abstract Registers a series of settings used by the Plugin
	 * 			 Prepares for notifications of settings changes
	 */
	async register(id: string) : Promise<void>
	{
		const dataDir = await joplin.plugins.dataDir();
		this.dataExchange = DataExchangeNs.DataExchange.fromPlugin(id, dataDir, ['signal']);

		await joplin.settings.registerSection(this.sectionName(), this.sectionLabel());
		await joplin.settings.registerSettings(this.descriptions(true));

		await this.updateCustomColumns();

		await joplin.settings.setValue('data_dir', dataDir);
		await joplin.settings.setValue('plugin_id', id);
		await this.setResourceDir();
	
		await joplin.settings.onChange(this.onChange.bind(this));
	}
	
	/**
	 * @abstract Change handler for settings changes on the Plugin side
	 * 
	 */
	async onChange(event: { keys: [string] }) : Promise<void>
	{
		console.info(`onChange triggered: ${event.keys}`);
		
		if (event.keys.includes('library_folder'))											// handles changes of the library folder
		{
			await this.updateCustomColumns();
		}
		else
		{
			await this.dataExchange.ChangeSetting('signal', event);
		}
	}
	
	/**
	 * @abstract Updates the custom columns in the select comboboxes
	 * 
	 */
	async updateCustomColumns() : Promise<void>
	{
		let msg = '';
		if (this.fullyRegistered)
		{
			msg = 
				'The settings are already fully registered, ' + 
				'to register with another Calibre library, you must restart the application';
			await joplin.views.dialogs.showMessageBox(msg);
			return;
		}

		try
		{
			const calibreLibrary = await this.libraryFolder();
			if (calibreLibrary.trim() !== '')
			{
				const calibreServices = new CalibreServices(calibreLibrary);
				this.custom_column_options = await calibreServices.custom_columns();
				await joplin.settings.registerSettings(this.descriptions(false));
				return;
			}
		}
		catch (e)
		{
			await joplin.settings.registerSettings(this.descriptions(false));
			msg = 
				`'${e}' accessing the Calibre library. The full functionality with ` + 
				'custom columns is not available.';
			await joplin.views.dialogs.showMessageBox(msg);
			return;
		}	

		await joplin.settings.registerSettings(this.descriptions(false));
		msg = 'No Calibre library configured. Functionality with custom columns not available.';
		await joplin.views.dialogs.showMessageBox(msg);
	}
	
	/**
	 * @abstract The global resource dir is set as local (plugin) setting 
	 * 
	 */
	async setResourceDir() : Promise<void>
	{
		const resourceDir = await joplin.settings.globalValue('resourceDir');
		await joplin.settings.setValue('resource_dir', resourceDir);
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
	
	async genreField() : Promise<string>
	{
		return await joplin.settings.value('genre_field');
	}
	
	async contentField() : Promise<string>
	{
		return await joplin.settings.value('content_field');
	}
	
	/**
	 * @abstract Iterates asynchronously through configured custom columns
	 */
	async *eachCustomColumn() : any
	{
		for (const idx of [1, 2, 3, 4, 5])
		{
			const cc = `custom_column_${idx}`;
			const cc_id = await joplin.settings.value(cc);
			if (cc_id > 0)
			{
				yield await Promise.resolve(cc_id);
			}
		}
	}
	
	/**
	 * @abstract Iterates asynchronously through configured custom column labels (column name like genre)
	 */
	async *eachCustomColumnLabel() : any
	{
		for await (const idx of this.eachCustomColumn())
		{
			const label = this.custom_column_options[idx];
			yield await Promise.resolve(label);
		}
	}
	
	async shrinkGenres() : Promise<string>
	{
		return await joplin.settings.value('filter_genres');
	}
	
	async filterTitles() : Promise<string>
	{
		return await joplin.settings.value('filter_titles');
	}
	
	async useSpoilers() : Promise<boolean>
	{
		return await joplin.settings.value('use_spoilers');
	}
	
	async coverHeight() : Promise<string>
	{
		return await joplin.settings.value('cover_height');
	}
	
	async convertHtml() : Promise<boolean>
	{
		return await joplin.settings.value('convert_html');
	}
	
	async insertAttributes() : Promise<boolean>
	{
		return await joplin.settings.value('insert_attributes');
	}
	
	async libraryFolder() : Promise<string>
	{
		return await joplin.settings.value('library_folder');
	}
	
	async mergeMode() : Promise<MergeMode>
	{
		return await joplin.settings.value('merge_mode');
	}
	
	async cleanupMode() : Promise<CleanupMode>
	{
		return await joplin.settings.value('cleanup_mode');
	}
	
	sectionName() : string
	{
		return 'CalibreImport.settings';
	}
	
	sectionLabel() : any
	{
		return { label: 'Calibre Import' };
	}
	
	descriptions(firstPass: boolean) : any
	{
		if (firstPass)
		{
			return {
				'plugin_id':
				{
					section: 'CalibreImport.settings',
					public: false,
					label: 'Plugin Id',
					value: '',
					type: SettingItemType.String,
					description: 'The id of the plugin.'
				},
				'data_dir':
				{
					section: 'CalibreImport.settings',
					public: false,
					label: 'Data Dir',
					value: '',
					type: SettingItemType.String,
					description: 'The data dir of the plugin.'
				},
				'resource_dir':
				{
					section: 'CalibreImport.settings',
					public: false,
					label: 'Resource Dir',
					value: '',
					type: SettingItemType.String,
					description: 'The resource dir of Joplin.'
				},
				'library_folder':
				{
					section: 'CalibreImport.settings',
					public: true,
					label: 'Library Folder',
					value: '',
					type: SettingItemType.String,
					subType: SettingItemSubType.DirectoryPath,
					description: 'The last used Calibre library selection. Reserved for future use.'
				}
			}
		};
		
		let settings = {
			'activate_attributes':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Activate Attributes',
				value: true,
				type: SettingItemType.Bool,
				description: 'The attributes Markdown-it extension recognizes one-line attributes definitions before other content.'
			},
			'genre_field':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Genre Field',
				value: 'genre',
				type: SettingItemType.String,
				description: 'The name of the Calibre custom field for hierarchical genres.'
			},
			'content_field':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Content Field',
				value: 'content',
				type: SettingItemType.String,
				description: 'The name of the Calibre custom field for additional information. It is Comments like and may be left empty.'
			}
		};
		if (this.custom_column_options)
		{
			settings = Object.assign(settings, 
			{		
				'custom_column_1':
				{
					section: 'CalibreImport.settings',
					public: true,
					label: 'Custom Column 1',
					value: 0,
					type: SettingItemType.Int,
					isEnum: true,
					options: this.custom_column_options,
					description: 'Up to 5 custom columns can be configured.'
				},
				'custom_column_2':
				{
					section: 'CalibreImport.settings',
					public: true,
					label: 'Custom Column 2',
					value: 0,
					type: SettingItemType.Int,
					isEnum: true,
					options: this.custom_column_options,
					description: 'Up to 5 custom columns can be configured.'
				},
				'custom_column_3':
				{
					section: 'CalibreImport.settings',
					public: true,
					label: 'Custom Column 3',
					value: 0,
					type: SettingItemType.Int,
					isEnum: true,
					options: this.custom_column_options,
					description: 'Up to 5 custom columns can be configured.'
				},
				'custom_column_4':
				{
					section: 'CalibreImport.settings',
					public: true,
					label: 'Custom Column 4',
					value: 0,
					type: SettingItemType.Int,
					isEnum: true,
					options: this.custom_column_options,
					description: 'Up to 5 custom columns can be configured.'
				},
				'custom_column_5':
				{
					section: 'CalibreImport.settings',
					public: true,
					label: 'Custom Column 5',
					value: 0,
					type: SettingItemType.Int,
					isEnum: true,
					options: this.custom_column_options,
					description: 'Up to 5 custom columns can be configured.'
				}
			});
		}
		settings = Object.assign(settings, 
		{
			'filter_genres':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Filter Genres',
				value: '%',
				type: SettingItemType.String,
				description: 'Use this field to enter a SQL LIKE string for the Genre field.'
			},
			'filter_titles':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Filter Titles',
				value: '%',
				type: SettingItemType.String,
				description: 'Use this field to enter a SQL LIKE string for the Title field.'
			},
			'cover_height':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Cover Height',
				value: '600px',
				type: SettingItemType.String,
				description: 'Used to configure the cover height of the Calibre Ebook Covers.'
			},
			'use_spoilers':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Use Spoilers',
				value: true,
				type: SettingItemType.Bool,
				description: 'The use of the Spoilers extension may be switched off or on.'
			},
			'convert_html':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Convert Html',
				value: true,
				type: SettingItemType.Bool,
				description: 'If activated, the content of comments-like fields will be translated from HTML to MD.'
			},
			'insert_attributes':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Insert Attributes',
				value: true,
				type: SettingItemType.Bool,
				description: 'During the conversion of Html attributes are inserted.'
			},
			'merge_mode':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Merge Mode',
				value: 1,
				type: SettingItemType.Int,
				isEnum: true,
				options: {
					0: 'Leave',
					1: 'Newest',
					2: 'Replace'
				},
				description: 'Controls the behavior if a Note is to be overwritten.'
			},
			'cleanup_mode':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Cleanup Mode',
				value: 1,
				type: SettingItemType.Int,
				isEnum: true,
				options: {
					0: 'Leave',
					1: 'Cleanup'
				},
				description: 'Controls the behavior for Notes / Notebook deletion after import.'
			}
		});
		
		this.fullyRegistered = true;
		return settings;
	}
	
	settings: any;
	custom_column_options: any = null;
	pluginOptions: any;
	dataExchange: DataExchangeNs.DataExchange;
	eventEmitter: any;
	signalListener: Function;
	fullyRegistered: boolean;
}


export const settings = new Settings();
