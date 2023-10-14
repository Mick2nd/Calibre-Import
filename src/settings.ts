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
			},
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
			'use_spoilers':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Use Spoilers',
				value: true,
				type: SettingItemType.Bool,
				description: 'The use of the Spoilers extension may be switched off or on.'
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
			'folder':
			{
				section: 'CalibreImport.settings',
				public: true,
				label: 'Library Folder',
				value: '',
				type: SettingItemType.String,
				subType: SettingItemSubType.DirectoryPath,
				description: 'The last used Calibre library selection. Reserved for future use.'
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
	
	settings: any;
}


export const settings = new Settings();
