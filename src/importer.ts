import { Calibre } from './calibre';
import { IEvents } from './events';
import { Tree } from './joplinData';


/**
 * @abstract Importer unites the Calibre and Tree classes to perform the import task
 * 
 */
export class Importer
{
	/**
	 * @abstract Asynchronous constructor function, to be used instead of constructor (new)
	 * 
	 */
	public static async default(library_path: string) : Promise<Importer>
	{
		const importer = new Importer();
		importer.joplin = await Tree.default();
		importer.calibre = new Calibre(importer.joplin, library_path);
		
		return importer;
	}
	
	/**
	 * @abstract Constructor
	 * 
	 */
	private constructor()
	{
		try
		{
			console.info('Importer');
		}
		catch(e)
		{
			console.error('Exception occurred: ' + e);
			throw e;
		}
	}
	
	/**
		@abstract Imports the archive
        - Extracts the relevant files from archive
        - Inserts them into Joplin by using the Joplin Data API 
	 */
	public import_it = async function() : Promise<void>
	{
		console.info('Importer.import_it')
		await this.calibre.parse();
	}
	
	calibre: Calibre;
	joplin: IEvents;
}