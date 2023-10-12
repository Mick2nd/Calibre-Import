import joplin from 'api';
import path = require('path');
import { IEvents } from './events';
import { joplinServices } from './joplinServices';
import { CleanupMode, MergeMode, settings } from './settings';


/**
 * @abstract Types enum
 * 
 */
export enum Type
{
	Tree,
	Book,
	Note
}

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
		const title = `${ebook['title']} (${ebook['id']})`;
		this.title = title;
		
		const book_path = ebook['path'];
		const has_cover = ebook['has_cover'];
		let md = `${this.styles()}# ${ebook['title']}\n\n`;										// adds styles and a title
		if (has_cover)
		{
			const cover_path = path.join(library_path, book_path, 'cover.jpg');
			const metadata = { title: title };
			const resp = await joplinServices.put_resource_by_file(metadata, cover_path);
			md += `![${title}](:/${resp["id"]})\n`;												// adds a cover if present
		}
		else
		{
			md += 'No Cover\n';
		}
		md += `|||\n|-|-|\n`;																	// table header (invisible)
		md += `${this.formats(library_path, ebook)}\n`;											// adds the formats as table line
		md += `|Authors:|${ebook['author_sort']}|`;
		
		md += await this.spoiler('Comments', ebook['comments']);								// adds the comments spoiler section
		const content = ebook['content'];
		if (content != undefined)
		{
			md += await this.spoiler('Content', content);										// adds the content spoiler section
		}
		
		this.body = md;
		const timestamp = ebook['timestamp'];													// will be used as created / updated times
		joplinServices.set_time(timestamp, timestamp);

		if (this.id === '')																		// this Note is new, does not have an id yet
		{
			const id = await joplinServices.put_note(this.parent_id, title, md);				// puts the md note into notebook
			this.id = id;
		}
		else																					// existing -> replace body and time
		{
			await joplinServices.put(['notes', this.id], null, { 'body': this.body });			// replace
		}

		return this;
	}
	
	public async mergeFromEbook(library_path: string, ebook: any) : Promise<void>
	{
		this.status = Status.Merge;
		const mergeMode = await settings.mergeMode();
		if (mergeMode == MergeMode.Leave)
		{
			
		}
		else if (mergeMode == MergeMode.Merge)
		{
			
		}
		else // Replace
		{
			await this.integrateContent(library_path, ebook);
		}
	}
	
	public constructor(parent: IBook2, raw: any)
	{
		super(parent, raw);
		this.type = Type.Note;
		this.status = Status.Present;
		
		this.body = raw['body'];
		parent.notes.push(this);
	}
	
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
	
	styles() : string
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
	}
	
	body: string;
}

/**
 * @abstract A Book class
 * 
 */
export class Book extends Node implements IBook2
{
	public static async default(parent: IBook, raw: any) : Promise<Book>
	{
		const book = new Book(parent, raw);
		await book.fillNotes();
		
		return book;
	}
	
	constructor(parent: IBook, raw: any)
	{
		super(parent, raw);
		this.type = Type.Book;
		
		this.status = Status.Present
		this.books = Array<IBook>();
		this.notes = Array<INode>();
		
		this.parent.books.push(this);
	}
	
	async fillNotes() : Promise<void>
	{
		const raw_notes = (await joplin.data.get(['folders', `${this.id}`, 'notes'])).items;
		for (const raw_note of raw_notes)
		{
			const note = new Note(this, raw_note);
		}
	}

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
	
	lookupBook(title: string) : Book | undefined
	{
		return this.books.find((book: any) => book.title == title) as Book;
	}
	
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
		await tree.prepare();
		
		/**
		 * TEST CODE
		 */
		for (const book of forEach(tree))
		{
			console.debug(book.title);
		}
		
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

	
	async onStart() : Promise<void>
	{
    	console.info('Tree.onStart');
		this.folder = await joplin.workspace.selectedFolder();
		this.book = this.lookupParent(this.folder.id);
	}

	async onBook(level: number, genre: string, id: number) : Promise<void>
	{
    	console.info(`Tree.onBook : ${genre}`);
		this.sub_book = await (this.book as Book).onBook(genre);
	}

	async onNote(library_path: string, book: any) : Promise<void>
	{
    	console.info(`Tree.onNote ${book['title']}`);
		await (this.sub_book as Book).onNote(library_path, book);
	}

	onIncrease() : void
	{
    	this.book = this.sub_book;
    	console.debug(`Tree: Increased level : ${(this.book as Book).title}`);
	}

	onDecrease() : void
	{
    	this.book = (this.book as Book).parent;
    	this.sub_book = undefined;
    	console.debug(`Tree: Decreased level : ${(this.book as Book).title}`);
	}

	async onStop() : Promise<void>
	{
    	console.info('Tree.onStop');
    	console.dir(this.book);
		await this.cleanupNotes();
	}
	
	
	constructor()
	{
		this.type = Type.Tree;
		this.status = Status.Undefined;
		this.parents = new Map<string, IBook>();
		this.books = new Array<IBook>();
	}
	
	async fillRaw() : Promise<void>
	{
		this.raw_books = (await joplin.data.get(['folders'])).items;
		// console.dir(this.raw);
	}
	
	async prepare() : Promise<void>
	{
		this.prepareParents();
		await this.prepareTree();
		// console.dir(this);
	}
	
	async prepareTree() : Promise<void>
	{
		for (let raw_book of this.raw_books)
		{
			const parent_id = raw_book['parent_id'];
			const parent = this.parents[parent_id];
			const id = raw_book['id'];
			// console.dir(raw_book);
			// console.debug(`ParentId : ${parent_id}`);

			const book: IBook = await Book.default(parent, raw_book);
			this.parents[id] = book;
		}
	}
	
	prepareParents() : void
	{
		this.parents[''] = this;
	}
	
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
	raw_books: [{}];
	index: number[];								// for fast access to parents
	parents: Map<string, IBook>;					// lookup the IBook instance given the parent id
	type: Type;
	status: Status;
	
	folder: any;
	book: IBook;									// the current Notebook
	sub_book: IBook;								// the current sub notebook (f.i. the just created one)
}

