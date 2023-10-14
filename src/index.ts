import joplin from 'api';
import { ImportContext, FileSystemItem, ContentScriptType } from 'api/types';
import { Importer } from './importer';
import { DataExchangeNs } from './dataExchange';
// require('source-map-support').install();

import { settings } from './settings';


/**
	@abstract Function or lambda to execute import command
	
	This is the real import module integrated in Import sub menu. It will be invoked by the Joplin
	framework, if a Calibre Sqlite Db is chosen.
 */
const import_module = async (ctx: ImportContext) : Promise<void> =>
{
	console.info('Just before returning Promise: ' + JSON.stringify(ctx));
	joplin.settings.setValue('folder', ctx.sourcePath);

	return new Promise(
		async function(resolve, reject) 
		{ 
			try 
			{
				console.info('Executing Import: ' + ctx.sourcePath);

				var importer = await Importer.default(ctx.sourcePath);
				await importer.import_it();
				
				console.info('Import successfully completed');
				resolve(); 
			}
			catch (ex)
			{
				console.error('Exception: ' + ex);
				reject();
			}
			finally
			{
				console.info('Final statement');
			}
		});
}

/**
 * @abstract Needed global instance for Data Exchange
 * 
 */
let dataExchange: any;

/**
 * @abstract Writes settings to persisted storage, meant for data exchange with the 
 * 			 MarkdownIt script.
 * 
 */
const onChange = async function(event: { keys: [string] }) : Promise<void>
{
	console.info(`onChange triggered: ${event.keys}`);
	for (const key of event.keys)
	{
		const val = await joplin.settings.value(key);
		await dataExchange.ChangeSetting(key, val); 
	}
}


/**
	@abstract Function to Setup the plugin
 */
async function setupPlugin()
{
	const id = 'de.habelt-jena.CalibreImport';
	
	await settings.register();
	
	const dataDir = await joplin.plugins.dataDir();
	dataExchange = DataExchangeNs.DataExchange.fromPlugin(id, dataDir, ['activate_attributes']);
	
	await joplin.settings.onChange(onChange);
	
	await joplin.interop.registerImportModule(
		{
			format: 'cldb',
			isNoteArchive: false,
			description: 'Calibre Library Database',
			fileExtensions: [ 'db', ],
			sources: [ FileSystemItem.Directory ],
			onExec: import_module
		}); 
		
	await joplin.contentScripts.register(
		ContentScriptType.MarkdownItPlugin,
		`${id}`,														// concatenate id with resources dir -> simpler way
		'./markdownIt.js'
	);
	
	/*	TEST CODE
	 *
	 */
	// await Joplin.default(null);
	// const tree = await Tree.default();
};


/**
	@abstract Registers the setup function
 */
joplin.plugins.register({
	onStart: async function() 
	{
		try
		{
			await setupPlugin();
		}
		catch(e)
		{ 
			console.error('Exception occurred: ' + e)		
		}
	}});

