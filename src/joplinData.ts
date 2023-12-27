import joplin from 'api';
import path = require('path');
import { IEvents } from './events';
import { joplinServices } from './joplinServices';
import { CleanupMode, MergeMode, settings } from './settings';
const fs = joplin.require('fs-extra');


/**
 * @abstract Types enum for Nodes
 * 
 */
export enum Type
{
	Tree,
	Book,
	Note
}

/**
 * @abstract Status used during import operation
 * 
 */
export enum Status
{
	Undefined,
	Present,
	Merge,
	Missing
}

/**
 * @abstract Interface for a Book containing other books
 * 
 */
export interface IBook
{
	books: Array<IBook>;
}

/**
 * @abstract Iterator through array in opposite order
 * 
 */
function* reverseIter<T>(array: T[])
{
	for (let idx = array.length - 1; idx >= 0; idx--)
	{
		yield array[idx];
	}
}

/**
 * @abstract Traverses a Book tree
 * 
 * @param book - the book to traverse
 * @param topFirst - flag, controls top first / bottom first behavior
 * @param reverse - flag, controls order of books in a single book
 */
function* forEach(book: IBook, topFirst: boolean = true, reverse: boolean = false)
{
	console.groupCollapsed('forEach');
	let iter: any = book.books;
	if (reverse)
	{
		iter = reverseIter(iter);
	}
	
	for (const child of iter)
	{
		if (topFirst)
		{
			yield child;
			yield * forEach(child, topFirst, reverse);
		}
		else
		{
			yield * forEach(child, topFirst, reverse);
			yield child;
		}
	}
	console.groupEnd();
}

/**
 * @abstract Interface for a Book containing other books and Notes
 * 
 */
export interface IBook2 extends IBook
{
	notes: Array<INode>;
}

/**
 * @abstract Interface for a Node having a parent 
 * 
 */
export interface INode
{
	status: Status;
	parent: IBook;
}

/**
 * @abstract A Node abstract class. Cannot be instantiated directly.
 * 
 */
export abstract class Node implements INode
{
	public constructor(parent: IBook, raw: any)
	{
		this.parent = parent;
		this.id = raw['id'];
		this.parent_id = raw['parent_id'];
		this.title = raw['title'];
	}
	
	type: Type;
	title: string;
	id: string;
	parent_id: string | null;
	parent: IBook;
	status: Status;
}

/**
 * @abstract A Note class
 * 
 */
export class Note extends Node
{
	/**
	 * @abstract Instantiates a new Note from Calibre Ebook
	 * 
	 * This is thought as a preparation for the true integration step. It must prepare the data required
	 * for such a step.
	 */
	public static async fromEbook(parent: Book, library_path: string, ebook: any) : Promise<Note>
	{
		console.debug(`Note.fromEbook`);
		
		const raw_note = { 'id': '', 'parent_id': parent.id, 'title': '', 'body': '' };
		let note = new Note(parent, raw_note);													// create a new one with status Missing
		await note.integrateContent(library_path, ebook);
		note.status = Status.Missing; 

		return note;
	}
	
	/**
	 * @abstract Integrates Ebook content in newly created or existing Note
	 * 
	 */
	async integrateContent(library_path: string, ebook: any) : Promise<Note>
	{
		console.debug(`Note.integrateContent: `);
		this.created = ebook['timestamp'];														// will be used as created / updated times
		this.updated = ebook['last_modified'];
		const title = `${ebook['title']} (${ebook['id']})`;
		this.title = title;
		
		const book_path = ebook['path'];
		const has_cover = ebook['has_cover'];
		let md = `${await this.styles()}# ${ebook['title']}\n\n`;								// adds styles and a title
		if (has_cover)
		{
			const cover_path = path.join(library_path, book_path, 'cover.jpg');
			if (fs.existsSync(cover_path))
			{
				const metadata = { title: title };
				const resp = await joplinServices.put_resource_by_file(metadata, cover_path);
				md += `![${title}](:/${resp["id"]})\n`;											// adds a cover if present
			}
		}
		else
		{
			md += 'No Cover\n';
		}
		md += await this.attributes('class=meta');
		md += `|||\n|-|-|\n`;																	// table header (invisible)
		md += `${this.formats(library_path, ebook)}\n`;											// adds the formats as table line
		md += `|Authors:|${ebook['author_sort']}|\n`;
		md += `|Series:|${ebook['series']}|\n`;
		
		for (const entries of ebook.cc_simple)													// add simple custom columns
		{
			for (const [idx, entry] of entries[1].entries())
			{
				if (idx == 0)
				{
					md += `|${entries[0]}:|${entry}|\n`;
				}
				else
				{
					md += `| |${entry}|\n`;				
				}
			} 
		}
		
		md += await this.spoiler('Comments', ebook['comments']);								// adds the comments spoiler section
		const content = ebook['content'];
		if (content != undefined)
		{
			md += await this.spoiler('Content', content);										// adds the content spoiler section
		}
		
		for (const entry of ebook.cc_comments)													// add custom columns with comments-like content
		{
			md += await this.spoiler(entry[0], entry[1]);
		}
		
		this.body = md;
		joplinServices.set_time(this.created, this.updated);

		if (this.id === '')																		// this Note is new, does not have an id yet
		{
			const response = await joplinServices.put_note(this.parent_id, title, md);			// puts the md note into notebook
			this.id = response.id;
		}
		else																					// existing -> replace body and time
		{
			await joplinServices.put(['notes', this.id], null, { 'body': this.body });			// replace
		}
		this.updateTags(ebook);

		return this;
	}
	
	/**
	 * @abstract Updates the tags of a given Note. New tags are taken from Calibre ebook, old tags are
	 * 			 deleted from Joplin.
	 * 
	 */
	public async updateTags(ebook: any) : Promise<void>
	{
		const remove = this.tags.filter((tag: string) => ! ebook['tags'].includes(tag));		// tags are to be removed (not in Calibre tag set)
		const add = ebook['tags'].filter((tag: string) => ! this.tags.includes(tag));			// tags are to be added (not already in Joplin tag set)
		for (const tag of add)
		{
			await joplinServices.put_tag(this.id, tag);
		}
		for (const tag of remove)
		{
			const tagid = (await joplinServices.get_tag(tag))[0].id;							// need an id !!
			await joplinServices.delete(['tags', tagid, 'notes', this.id]);
		}
		this.tags = ebook['tags']; 
	}
	
	
	/**
	 * @abstract Import operation if status is Merge, e.g. Note is already present in Joplin
	 * 			 and again present in Import collection. Uses the merge mode to decide about
	 * 			 operation.
	 * 
	 * @param library_path - the path to the Calibre library
	 * @param ebook - the ebook's data
	 */
	public async mergeFromEbook(library_path: string, ebook: any) : Promise<void>
	{
		this.status = Status.Merge;
		const mergeMode = await settings.mergeMode();
		const updated = ebook['last_modified'];													// used for merge mode
		
		if (mergeMode == MergeMode.Leave)
		{
			
		}
		else if (mergeMode == MergeMode.Merge)
		{
			if (updated > this.updated)															// ebook meta data newer then Joplin entry
			{
				console.debug('About to update note');
				await this.integrateContent(library_path, ebook);
			}
		}
		else if (mergeMode == MergeMode.Replace)
		{
			await this.integrateContent(library_path, ebook);
		}
	}
	
	/**
	 * @abstract Cosntructor. Can be invoked by fromEbook or Book.fillNotes
	 * 
	 */
	public constructor(parent: IBook2, raw: any)
	{
		super(parent, raw);
		this.type = Type.Note;
		this.status = Status.Present;
		this.tags = new Array<string>();
		
		this.body = raw['body'];
		if (raw['user_created_time'])													// raw comes from Joplin API
		{
			this.created = new Date(raw['user_created_time']).toISOString();
			this.created = this.created.replace('T', ' ').replace('Z', '+00:00');
			this.updated = new Date(raw['user_updated_time']).toISOString();
			this.updated = this.updated.replace('T', ' ').replace('Z', '+00:00');
		}
		parent.notes.push(this);
	}
	
	/**
	 * @abstract Returns the required Note fields
	 * 
	 */
	static get requiredFields() : string[]
	{
		return ['id', 'parent_id', 'title', 'user_updated_time', 'user_created_time'];
	}
	
	/**
	 * @abstract Provides content for a MD Note depending on the useSpoilers setting.
	 * 			 It is either a Spoiler or pure MD.
	 *
	 * @param label - the label for the content
	 * @param content - the content itself 
	 */
	async spoiler(label: string, content: string) : Promise<string>
	{
		if (await settings.useSpoilers())
		{
			return `

:[
${label}

${content}

]:
`;		}
		else
		{
			return `

## ${label}

${content}

`;		}
	}
	
	/**
	 * @abstract Provides table entry for the ebook formats
	 * 
	 * @param library_path - the library path, used to build links
	 * @param book - the ebook
	 */
	formats(library_path: string, book: any) : string
	{
		const book_path = path.join(library_path, book['path']);
		const links = book['formats'].map((format: string) =>
		{
			const target = path.join(book_path, book['name']).replace(/ /g, '%20') + '.' + format.toLowerCase();
			return `[${format}](file:///${target})`;
		});
		
		return `|Formats:|${links.join(', ')}|`;
	}
	
	/**
	 * @abstract Provides note specific styles to be inserted at the beginning
	 * 
	 */
	async styles() : Promise<string>
	{
		return `
<style>
	img { height: ${await settings.coverHeight()}; }
	table { border-style: hidden; border-collapse: collapse; width: 100%; }
	td { font-size: small; }
	td strong { font-size: large; font-weight: 600; }
	.meta td:nth-child(odd) { font-style: Italic }
</style>
`;
	}

	/**
	 * @abstract Returns an attribute line or empty string depending on setting.
	 * 
	 */	
	async attributes(attrs: string) : Promise<string>
	{
		if (await settings.insertAttributes())
		{
			return `///attributes:${attrs}\n`;
		}
		return '';
	}
	
	body: string;
	created: string = new Date().toUTCString();
	updated: string = new Date().toUTCString();
	tags: string[];
}


/**
 * @abstract A Book class representing a Joplin Notebook
 * 
 */
export class Book extends Node implements IBook2
{
	/**
	 * @abstract An asynchronous constructor function
	 * 			 Additionally to the constructor fills the Notes array.
	 * 
	 * @param parent - the parent book or tree
	 * @param raw - the raw data for the book
	 */
	public static async default(parent: IBook, raw: any) : Promise<Book>
	{
		const book = new Book(parent, raw);
		// await book.fillNotes();
		
		return book;
	}
	
	/**
	 * @abstract Constructor.
	 * 
	 * @param parent - the parent book or tree
	 * @param raw - the raw data for the book
	 */
	constructor(parent: IBook, raw: any)
	{
		super(parent, raw);
		this.type = Type.Book;
		
		this.status = Status.Present
		this.books = Array<IBook>();
		this.notes = Array<INode>();
		
		this.parent.books.push(this);
	}
	
	/**
	 * @abstract Fills the Joplin Notes into the book belonging to this Notebook
	 * 
	 */
	async fillNotes() : Promise<void>
	{
		for await (const raw_note of joplinServices.all(								// this api allows for single iteration through all pages
			['folders', `${this.id}`, 'notes'],
			{ fields: Note.requiredFields }
		))
		{
			const note = new Note(this, raw_note);										// appends Note to parent's notes array 
			const response = await joplinServices.get(['notes', note.id, 'tags']);		// returns all the tags of this note
			note.tags = response.items.map((tag: any) => tag.title);
		}
		console.dir(this);
	}

	/**
	 * @abstract Invoked by the Tree.onBook 
	 * 
	 * @param genre - the genre to be represented by this book
	 */
	async onBook(genre: string) : Promise<Book>
	{
		let book = this.lookupBook(genre);
		if (book)																		// searches the given genre in current Notebook -> present
		{
			book.status = Status.Merge;													// change status to Merge because its in Calibre again
		}
		else																			// not Present in Joplin
		{
			const parent_id = this.id;
			const raw_book = { 'id': '', 'parent_id': parent_id, 'title': genre }
			book = new Book(this, raw_book);											// create a new one with status Missing
			book.status = Status.Missing; 
			
			const resp = await joplinServices.put_folder(this.id, genre);            	// put it as folder
			book.id = resp['id'];		
		}
		
		return book;
	}

	/**
	 * @abstract Invoked by Tree.onNote
	 * 
	 * Depending from the presence of the Note in Joplin (e.g. Status) is the handling by
	 * different instantiations.
	 * 
	 * @param library_path - the Calibre library path
	 * @param ebook - the ebook's raw data from Calibre
	 */
	async onNote(library_path: string, ebook: any) : Promise<void>
	{
		let note = this.lookupNote(ebook);
		if (note)
		{
			note.status = Status.Merge;
			await note.mergeFromEbook(library_path, ebook);
		}
		else
		{
			note = await Note.fromEbook(this, library_path, ebook);
		}
	}
	
	/**
	 * @abstract Lookup a Book by title (originated by genre)
	 * 
	 */
	lookupBook(title: string) : Book | undefined
	{
		return this.books.find((book: any) => book.title == title) as Book;
	}
	
	/**
	 * @abstract Lookup a Note by title. The title is different from the original title
	 * 			 in that it consists of original Ebook's title and id fields.
	 * 
	 */
	lookupNote(ebook: any) : Note | undefined
	{
		const title = `${ebook['title']} (${ebook['id']})`;
		return this.notes.find((note: any) => note.title == title) as Note;
	}
	
	books: Array<IBook>;
	notes: Array<INode>;
}

/**
 * @abstract A class representing the whole tree of Notebooks.
 * 
 */
export class Tree implements IBook, IEvents
{
	/**
	 * @abstract Asynchronous constructor function
	 * 
	 */
	public static async default() : Promise<Tree>
	{
		const tree = new Tree();
		
		await tree.fillRaw();
		await tree.prepareTree();
		await tree.fillNotes();
		
		return tree; 
	}
	
	/**
	 * @abstract Returns a Notebook given its id in Joplin. This serves as working Notebook for the
	 * 			 import.
	 */
	public lookupParent(id: string) : IBook2
	{
		return this.parents[id];
	}

	/**
	 * @abstract The import process is accompanied by the invokation of the IEvent methods.
	 * 			 Calibre -> Tree
	 * 
	 * This one indicates the start of the import.
	 */
	async onStart() : Promise<void>
	{
    	console.info('Tree.onStart');
		this.folder = await joplin.workspace.selectedFolder();
		this.book = this.lookupParent(this.folder.id);
	}

	/**
	 * @abstract The import process is accompanied by the invokation of the IEvent methods.
	 * 			 Calibre -> Tree
	 *
	 * This one indicates the delivery of a Genre.
	 */
	async onBook(level: number, genre: string, id: number) : Promise<void>
	{
    	console.info(`Tree.onBook : ${genre}`);
		this.sub_book = await (this.book as Book).onBook(genre);
	}

	/**
	 * @abstract The import process is accompanied by the invokation of the IEvent methods.
	 * 			 Calibre -> Tree
	 * 
	 * This one indicates the delivery of an Ebook.
	 */
	async onNote(library_path: string, book: any) : Promise<void>
	{
    	console.info(`Tree.onNote ${book['title']}`);
		await (this.sub_book as Book).onNote(library_path, book);
	}

	/**
	 * @abstract The import process is accompanied by the invokation of the IEvent methods.
	 * 			 Calibre -> Tree
	 * 			 This is one of them.
	 * 
	 * This one indicates the increase of the nesting level.
	 */
	onIncrease() : void
	{
    	this.book = this.sub_book;
    	console.debug(`Tree: Increased level : ${(this.book as Book).title}`);
	}

	/**
	 * @abstract The import process is accompanied by the invokation of the IEvent methods.
	 * 			 Calibre -> Tree
	 * 
	 * This one indicates the decrease of the nesting level.
	 */
	onDecrease() : void
	{
    	this.book = (this.book as Book).parent;
    	this.sub_book = undefined;
    	console.debug(`Tree: Decreased level : ${(this.book as Book).title}`);
	}

	/**
	 * @abstract The import process is accompanied by the invokation of the IEvent methods.
	 * 			 Calibre -> Tree
	 *
	 * This one indicates the completion of the import and will be used for cleanup tasks.
	 * For instance the Cleanup mode is implemented. 
	 */
	async onStop() : Promise<void>
	{
    	console.info('Tree.onStop');
    	console.dir(this.book);
		await this.cleanupNotes();
	}
	
	/**
	 * @abstract Constructor
	 * 
	 */
	constructor()
	{
		this.type = Type.Tree;
		this.status = Status.Undefined;
		this.parents = new Map<string, IBook>();
		this.books = new Array<IBook>();
	}
	

	/**
	 * @abstract Fills the raw Joplin Notebooks with a query for the Base folder
	 * 
	 */	
	async fillRaw() : Promise<void>
	{
		this.raw_books = [];
		
		for await (const raw_books of joplinServices.allChunks(['folders']))
		{
			this.raw_books = this.raw_books.concat(raw_books);
		}
		console.debug('fillRaw done');
		console.dir(this.raw_books);
	}
	
	/**
	 * @abstract  Transforms the raw data into the final representation
	 * 
	 */
	async prepareTree() : Promise<void>
	{
		this.parents[''] = this;										// preparation so that lookup can find top level Notebook's parent

		let count = 0;
		let raw_books = this.raw_books;
		let remaining_books = [];
		
		while(raw_books.length > 0)
		{
			for (let raw_book of raw_books)
			{
				const parent_id = raw_book['parent_id'];
				const parent = this.parents[parent_id];
				if (!parent)
				{
					console.warn(`prepareTree parent lookup failed for ${raw_book.title}`);
					remaining_books.push(raw_book);
					continue;
				}
	
				count ++;
				const id = raw_book['id'];
				const book: IBook = await Book.default(parent, raw_book);
				this.parents[id] = book;
			}
			
			raw_books = remaining_books;
			remaining_books = []; 
		}
		
		console.info(`prepareTree listed ${count} of ${this.raw_books.length} entries`);
	}
	
	/**
	 * @abstract New! Instead of filling the notes immediately this is done now after assembly
	 * 			 of the Notebook tree. 
	 * 
	 */
	async fillNotes() : Promise<void>
	{
		this.folder = await joplin.workspace.selectedFolder();
		if (! this.folder)
		{
			throw new Error(`There is no folder selected`);								// according documentation this should not occur
		}
		this.book = this.lookupParent(this.folder.id);

		for (const book of forEach(this.book))
		{
			await book.fillNotes();
		}		
	}
	
	/**
	 * @abstract Performs cleanup tasks. Behavior depends on cleanup mode.
	 * 
	 */
	async cleanupNotes() : Promise<void>
	{
		if (await settings.cleanupMode() !== CleanupMode.Cleanup)
		{
			return;
		}
		for (let book of forEach(this.book, false, true))
		{
			let idx = book.notes.length;
			for (const note of reverseIter<Note>(book.notes))
			{
				idx --;
				console.debug(`Tree.cleanupNotes: ${note.title}, ${note.status}`);
				if (note.status == Status.Present)									// not in new Import
				{
					book.notes.splice(idx, 1);	
					await joplinServices.delete(['notes', note.id]);		
				}
			}
			
			if (book.notes.length === 0 && book.books.length === 0)					// is the book empty? -> then delete it
			{																		// evt. extra step
				idx = book.parent.books.findIndex((bk: IBook) => bk == book);
				book.parent.books.splice(idx, 1);	
				await joplinServices.delete(['folders', book.id]);
			}
		}
	}
	
	books: Array<IBook>;
	raw_books: any[];
	index: number[];								// for fast access to parents
	parents: Map<string, IBook>;					// lookup the IBook instance given the parent id
	type: Type;
	status: Status;
	
	folder: any;
	book: IBook;									// the current Notebook
	sub_book: IBook;								// the current sub notebook (f.i. the just created one)
}

