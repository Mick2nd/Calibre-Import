import joplin from 'api';
import { ImportContext, FileSystemItem, ContentScriptType } from 'api/types';
import { Importer } from './importer';
// require('source-map-support').install();

import { settings } from './settings';


/**
 *	@abstract Function or lambda to execute import command
 *	
 *	This is the real import module integrated in Import sub menu. It will be invoked by the Joplin
 *	framework, if a Calibre Sqlite Db is chosen.
 */
const import_module = async (ctx: ImportContext) : Promise<void> =>
{
	console.info('Just before returning Promise: ' + JSON.stringify(ctx));
	joplin.settings.setValue('library_folder', ctx.sourcePath);

	return new Promise(
		async function(resolve, reject) 
		{ 
			try 
			{
				console.info('Executing Import: ' + ctx.sourcePath);
				
				const folder = await joplin.workspace.selectedFolder();
				const confirmation = `This may delete all Notebooks and Notes in the selected Notebook '${folder.title}'. Are you sure?`;
				if (await joplin.views.dialogs.showMessageBox(confirmation) == 1)
				{
					resolve();
					return;
				}

				var importer = await Importer.default(ctx.sourcePath);
				await importer.import_it();
				
				resolve(); 
				const msg = 'Import successfully completed';
				console.info(msg);
				await joplin.views.dialogs.showMessageBox(msg);
			}
			catch (ex)
			{
				reject();
				const msg = `${ex}`;
				console.error(msg);
				await joplin.views.dialogs.showMessageBox(msg);
			}
			finally
			{
				console.info('Final statement');
			}
		});
}


/**
 *	@abstract Function to Setup the plugin
 */
async function setupPlugin()
{
	const id = 'de.habelt-jena.CalibreImport';
	
	await settings.register(id);
	
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
};


/**
 *	@abstract Registers the setup function
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

