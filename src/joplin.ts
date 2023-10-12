import joplin from 'api';

import { StringDecoder } from 'string_decoder';
import path = require('path');

import { IEvents } from './events';
import { Tree } from './joplinData';
import { joplinServices } from './joplinServices';


/**
 *	@abstract This class is responsible for interaction with the Joplin Data API
 */
export class Joplin implements IEvents
{
	/**
	 * @abstract Alternative constructor method
	 * 
	 */
	public static async default(parent: any) : Promise<IEvents>
	{
		
		/*	TEST CODE
		 *
		 */
		// const folder = await joplin.workspace.selectedFolder();
		// const folders = await joplin.data.get(['folders']);
		// console.dir(folders);

		let myJoplin = new Joplin(parent);
		return myJoplin;
	}
	
	/**
	 *	@abstract Constructor
	 */
	constructor(parent: any)
	{
		this.parent = parent;
		
		this.decoder = new StringDecoder('utf-8');
		this.encoder = new TextEncoder();
	}
	
	async onStart(library_path: string): Promise<void> 
	{
    	console.info('Joplin.onStart');
    	this.library_path = library_path;
		this.folder = await joplin.workspace.selectedFolder();
		this.folders = [];
		
		// this.tree = new Tree();
	}
	
	async onBook(level: number, genre: string, id: number): Promise<void> 
	{
    	console.debug(`${level} : ${genre} : ${id}`);
		this.sub_folder = await joplinServices.put_folder(this.folder.id, genre);               // put it as folder
		this.genre_id = id;
	}
	
	async onNote(library_path: string, book: any) : Promise<void>
	{
		const id = book['id'];
		const title = book['title'];
		const book_path = book['path'];
		const has_cover = book['has_cover'];
		
		let md = `${this.styles()}# ${title}\n\n`;												// adds styles and a title
		if (has_cover)
		{
			const cover_path = path.join(this.library_path, book_path, 'cover.jpg');
			const metadata = { title: title };
			const resp = await joplinServices.put_resource_by_file(metadata, cover_path);
			md += `![${title}](:/${resp["id"]})\n`;												// adds a cover if present
		}
		else
		{
			md += 'No Cover\n';
		}
		md += `|||\n|-|-|\n`;																	// table header (invisible)
		md += `${this.formats(book)}\n`;														// adds the formats as table line
		md += this.spoiler('Kommentare', book['comments']);										// adds the comments spoiler section
		const content = book['content'];
		if (content != undefined)
		{
			md += this.spoiler('Inhalt', content);												// adds the content spoiler section
		}

		const nbid = this.sub_folder.id;
		await joplinServices.put_note(nbid, title, md);													// puts the md note into notebook
	}
	
	onIncrease(): void 
	{
    	console.debug('Increased level');
    	this.folders.push(this.folder);
    	this.folder = this.sub_folder;
    	
	}
	
	onDecrease(): void 
	{
    	console.debug('Decreased level');
    	this.sub_folder = this.folder;
    	this.folder = this.folders.pop();
	}
	
	onStop(): void 
	{
    
	}

	
	spoiler = function(label: string, content: string) : string
	{
		return `

:[
${label}

${content}

]:
`;
	}
	
	formats = function(book: any) : string
	{
		const book_path = path.join(this.library_path, book['path']);
		const links = book['formats'].map((format: string) =>
		{
			const target = path.join(book_path, book['name']).replace(/ /g, '%20') + '.' + format.toLowerCase();
			return `[${format}](file:///${target})`;
		});
		
		return `|Formate:|${links.join(', ')}|`;
	}
	
	
	styles = function() : string
	{
		return `
<style>
	img { height: 600px; }
	table { border-style: hidden; border-collapse: collapse; }
	thead { display: none; }
	td { font-size: small; }
	td:nth-child(odd) { font-style: Italic }
</style>
`;
/*	Keep this styling although no longer needed
	div.table { display: table; }
	div.row { display: table-row; }
	p.cell { display: table-cell; font-size: small; }
	p.label { padding-right: 5px; font-style: Italic; }
	p.content { padding-left: 5px; }
*/	
	}
	
	parent: any;
	library_path: string;
	decoder: any;
	encoder: TextEncoder;
	created: number = new Date().valueOf();
	updated: number = new Date().valueOf();
	folders: Array<any>;
	folder: any;
	sub_folder: any;
	genre_id: number;
	tree: Tree;
}
