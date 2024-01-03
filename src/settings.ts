import joplin from 'api';
import { SettingItemType, SettingItemSubType } from 'api/types';
import { DataExchangeNs } from './dataExchange';
import { CalibreServices } from './calibreServices';
const path = require('path');


/**
 * @abstract The Merge Mode for the import controls the action when notes from Calibre meet with
 * 			 existing notes in Joplin.
 * 			 - Leave 	- Notes in Joplin are left as is
 * 			 - Merge 	- Notes in Joplin are replaced if the note in Calibre is newer
 * 			 - Replace	- Notes in Joplin are always replaced
 */
export enum MergeMode
{
	Leave,
	Merge,
	Replace
}

/**
 * @abstract The Cleanup Mode controls the action what needs to be done with left-over-nodes which
 * 			 were not imported during the current session.
 * 			 Leave		- the are left
 * 			 Cleanup	- they are deleted
 */
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
	/**
	 * @abstract Constructor
	 */
	constructor()
	{
		this.custom_column_number = 10;										// number can be easily changed
		this.fullyRegistered = false;
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

		await this.updateCustomColumns(true);

		await joplin.settings.setValue('data_dir', dataDir);
		await joplin.settings.setValue('plugin_id', id);
		await this.setResourceDir();
	
		await joplin.settings.onChange(this.onChange.bind(this));
	}
	
	/**
	 * @abstract Change handler for settings changes on the Plugin side.
	 * 			 Library Folder changes are used to update the custom columns definitions.
	 * 			 All other changes are reported to the Markdown-it script.
	 */
	onChange(event: { keys: [string] }) : void
	{
		console.info(`onChange triggered: ${event.keys}`);
		
		if (event.keys.includes('library_folder'))											// handles changes of the library folder
		{
			this.updateCustomColumns(false)
			.finally(() => { console.info('Custom Columns changed'); });
		}
		else
		{
			this.dataExchange.ChangeSetting('signal', event);
		}
	}
	
	/**
	 * @abstract Updates the custom columns in the select comboboxes
	 * 
	 */
	async updateCustomColumns(initial: boolean) : Promise<void>
	{
		/**
		 * @abstract Comapres 2 arrays for equality
		 * 
		 */
		const isEqual = (a: any, b: any) =>
			Array.isArray(a) && Array.isArray(b) &&
			a.length === b.length &&
			a.every((element: any, index: number) => element === b[index]);				

		/**
		 * @abstract Queries the new options from the Calibre library db
		 * 
		 */
		async function getCustomColumnOptions(parent: any) : Promise<any>
		{
			try
			{
				const calibreLibrary = await parent.libraryFolder();
				const calibreServices = new CalibreServices(calibreLibrary);							// can throw
				const custom_column_options = await calibreServices.custom_columns();
				return { options: custom_column_options, err: undefined };
			}
			catch(e)
			{
				return { options: undefined, err: e };
			}
		}
		
		const response = await getCustomColumnOptions(this);
		if (initial)																					// initial invokation during app start
		{
			this.custom_column_options = response.options;
			await joplin.settings.registerSettings(this.descriptions(false));
			if (response.err)																			// library was not readable
			{
				const msg = 
					`'${response.err}' accessing the Calibre library. The full functionality with ` + 
					'custom columns is not available.';
				await joplin.views.dialogs.showMessageBox(msg);
				return;
			}
		}
		else																							// a change occurred
		{
			if (response.err)
			{
				const msg = 
					`'${response.err}' accessing the Calibre library. For full functionality select a ` + 
					'valid library and restart the application.';
				await joplin.views.dialogs.showMessageBox(msg);
				return;
			}
			if (! isEqual(response.options, this.custom_column_options))								// options changed
			{
				if (this.custom_column_options)
				{
					for await (const cc of this.eachCustomColumnName())									// reset the custom column values
					{
						await joplin.settings.setValue(cc, 0);
					}
				}
				
				const msg = 
					'The Calibre library changed, please restart the application';
				await joplin.views.dialogs.showMessageBox(msg);
				return;
			}
		}
	}
	
	/**
	 * @abstract The global resource dir is set as local (plugin) setting 
	 */
	async setResourceDir() : Promise<void>
	{
		const resourceDir = await joplin.settings.globalValue('resourceDir');
		await joplin.settings.setValue('resource_dir', resourceDir);
	}

	/**
	 * @abstract Returns the Genre Field
	 */	
	async genreField() : Promise<string>
	{
		return await joplin.settings.value('genre_field');
	}
	
	/**
	 * @abstract Returns the Content Field
	 */	
	async contentField() : Promise<string>
	{
		return await joplin.settings.value('content_field');
	}
	
	/**
	 * @abstract Iterates asynchronously through configured custom columns
	 * 
	 * @returns		- settings names
	 */
	async *eachCustomColumnName() : any
	{
		for (let idx = 1; idx <= this.custom_column_number; idx++)
		{
			const cc = `custom_column_${idx}`;
			yield await Promise.resolve(cc);
		}
	}
	
	/**
	 * @abstract Iterates asynchronously through configured custom columns
	 * 
	 * @returns		- custom columns indices as configured
	 */
	async *eachCustomColumn() : any
	{
		for (let idx = 1; idx <= this.custom_column_number; idx++)
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
	 * 
	 * @returns		- custom columns labels
	 */
	async *eachCustomColumnLabel() : any
	{
		for await (const idx of this.eachCustomColumn())
		{
			const label = this.custom_column_options[idx];
			if (!label)
			{
				console.warn(`Invalid label 'undefined' at index ${idx} : ${this.custom_column_options}`);
			}
			else
			{
				yield await Promise.resolve(label);
			}
		}
	}
	
	
	/**
	 * @abstract Returns the Cache folder where the Plugin assets are stored
	 * 			 TODO: check for the development version of the plugin
	 * 
	 * @returns		- the cache dir or the dist folder in Eclipse for development
	 */
	async cacheDir() : Promise<string>
	{
		const fs = joplin.require('fs-extra');
		const resourceDir = await joplin.settings.globalValue('resourceDir');
		const pluginId = await joplin.settings.value('plugin_id');
		const dir = path.join(resourceDir, '..', 'cache', pluginId);
		if (!fs.existsSync(dir))
		{
			return "D:/Users/jsoft/Programmieren/workspace-2020-09/CalibreImport/dist";
		}
		return dir;
	}
	
	/**
	 * @abstract Returns a SQL pattern for Genres to be imported
	 */	
	async shrinkGenres() : Promise<string>
	{
		return await joplin.settings.value('filter_genres');
	}
	
	/**
	 * @abstract Returns a SQL pattern for Titles to be imported
	 */	
	async filterTitles() : Promise<string>
	{
		return await joplin.settings.value('filter_titles');
	}
	
	/**
	 * @abstract Returns a flag controlling the use of Spoilers (plugin) for comments - like fields
	 */	
	async useSpoilers() : Promise<boolean>
	{
		return await joplin.settings.value('use_spoilers');
	}
	
	/**
	 * @abstract Returns the cover height for cover images. A CSS style is generated for this.
	 */	
	async coverHeight() : Promise<string>
	{
		return await joplin.settings.value('cover_height');
	}
	
	/**
	 * @abstract Controls the translation of Comments - like fields
	 */	
	async convertHtml() : Promise<boolean>
	{
		return await joplin.settings.value('convert_html');
	}
	
	/**
	 * @abstract Controls the generation of Attributes. This makes only sense if the markdown-it
	 * 			 plugin is activated.
	 */	
	async insertAttributes() : Promise<boolean>
	{
		return await joplin.settings.value('insert_attributes');
	}
	
	/**
	 * @abstract Returns the Calibre Library folder. Used for custom columns
	 * 
	 */
	async libraryFolder() : Promise<string>
	{
		return await joplin.settings.value('library_folder');
	}
	
	/**
	 * @abstract Returns the Merge Mode. See above.
	 * 
	 */
	async mergeMode() : Promise<MergeMode>
	{
		return await joplin.settings.value('merge_mode');
	}
	
	/**
	 * @abstract Returns the Cleanup Mode. See above.
	 * 
	 */
	async cleanupMode() : Promise<CleanupMode>
	{
		return await joplin.settings.value('cleanup_mode');
	}
	
	/**
	 * @abstract The section name to be used internally by Joplin for these settings
	 */
	sectionName() : string
	{
		return 'CalibreImport.settings';
	}
	
	/**
	 * @abstract The section label name to be used by Joplin for these settings
	 */
	sectionLabel() : any
	{
		return { label: 'Calibre Import' };
	}
	
	/**
	 * @abstract Returns the descriptions of the settings how they are needed by Joplin.
	 * 			 This is done in 2 passes:
	 * 			 - the first pass returns settings which are always required
	 * 			 - the second pass returns all other settings including custom columns
	 * 
	 * @param firstPass - true for the first pass invocation
	 * @returns			- the descriptions for the settings
	 */
	descriptions(firstPass: boolean) : any
	{
		console.log(
			`descriptions: ${firstPass}, custom column options: ` + 
			`${JSON.stringify(this.custom_column_options)}`);
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
			console.log('custom_column_options available');
			settings = Object.assign(
				settings, 
				this.custom_column_descriptions(this.custom_column_number));					// dynamicallly generated
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
	
	/**
	 * @abstract Given the number of custom columns this functions produces a description object
	 * 
	 * @param no 	- number of custom columns to be generated
	 * @returns		- descriptions for custom columns
	 */
	custom_column_descriptions(no: number) : any
	{
		let descriptions = { };
		
		for (let idx = 1; idx <= no; idx++)
		{
			const cc = `custom_column_${idx}`;
			const cc_val =		
				{
					section: 'CalibreImport.settings',
					public: true,
					label: `Custom Column ${idx}`,
					value: 0,
					type: SettingItemType.Int,
					isEnum: true,
					options: this.custom_column_options,
					description: `Up to ${no} custom columns can be configured.`
				};
			descriptions[cc] = cc_val;
		}
		
		return descriptions;
	}
	

	settings: any;
	custom_column_options: any = null;
	custom_column_number: number;
	dataExchange: DataExchangeNs.DataExchange;
	eventEmitter: any;
	fullyRegistered: boolean;
}


export const settings = new Settings();
