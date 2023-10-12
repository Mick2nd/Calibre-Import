import joplin from 'api';
import { SettingItemType, SettingItemSubType } from 'api/types';


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

export class Settings
{
	constructor()
	{
		this.settings = 
		{
			'activate_attributes':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Activate Attributes',
				value: true,
				type: SettingItemType.Bool
			},
			'genre_field':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Genre Field',
				value: 'genre',
				type: SettingItemType.String
			},
			'content_field':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Content Field',
				value: 'content',
				type: SettingItemType.String
			},
			'shrink_genres':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Shrink Genres',
				value: '%',
				type: SettingItemType.String,
				description: 'Use this field to enter a SQL LIKE string for the Genre field'
			},
			'use_spoilers':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Use Spoilers',
				value: true,
				type: SettingItemType.Bool
			},
			'convert_html':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Convert Html',
				value: true,
				type: SettingItemType.Bool
			},
			'insert_attributes':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Insert Attributes',
				value: true,
				type: SettingItemType.Bool,
				description: 'During the conversion of Html attributes are inserted'
			},
			'folder':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Library Folder',
				value: '',
				type: SettingItemType.String,
				subType: SettingItemSubType.DirectoryPath
			},
			'merge_mode':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Merge Mode',
				value: 0,
				type: SettingItemType.Int,
				isEnum: true,
				options: {
					0: 'Leave',
					1: 'Merge (experimental)',
					2: 'Replace'
				}
			},
			'cleanup_mode':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Cleanup Mode',
				value: 0,
				type: SettingItemType.Int,
				isEnum: true,
				options: {
					0: 'Leave',
					1: 'Cleanup'
				}
			}
		}
	}
	
	sectionName() : string
	{
		return 'CalibreImport.settings';
	}
	
	sectionLabel() : any
	{
		return { label: 'Calibre Import' };
	}
	
	descriptions() : any
	{
		return this.settings;
	}
	
	/**
	 * @abstract Registers a series of settings used by the Plugin
	 * 
	 */
	async register() : Promise<void>
	{
		await joplin.settings.registerSection(this.sectionName(), this.sectionLabel());
		await joplin.settings.registerSettings(this.descriptions());
	}
	
	async genreField() : Promise<string>
	{
		return await joplin.settings.value('genre_field');
	}
	
	async contentField() : Promise<string>
	{
		return await joplin.settings.value('content_field');
	}
	
	async shrinkGenres() : Promise<string>
	{
		return await joplin.settings.value('shrink_genres');
	}
	
	async useSpoilers() : Promise<boolean>
	{
		return await joplin.settings.value('use_spoilers');
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
	
	settings: any;
}


export const settings = new Settings();
