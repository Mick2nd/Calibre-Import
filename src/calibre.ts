import joplin from 'api';
import path = require('path');
const sqlite = joplin.require('sqlite3');
const fs = joplin.require('fs-extra');
import { IEvents } from './events';
import { settings } from './settings';
import { turndownServices } from './turndownServices';


/**
 * @abstract This class provides an interface to extract information from a Calibre database
 * 
 */
export class Calibre
{
	/**
		@abstract Constructor
	*/
	public constructor(parent: IEvents, library_path: string)
	{
		try
		{
			console.info(`Calibre`);
			this.parent = parent;
			this.library_path = library_path;
			this.db_path = path.join(library_path, 'metadata.db');
			if (fs.existsSync(this.db_path))
			{
				this.db = new sqlite.Database(this.db_path, sqlite.OPEN_READONLY)
			}
			else
			{
				// alert('Calibre Db file not found');
				throw new Error('Calibre Db file not found');
			}
		}
		catch(e)
		{
			console.error('Exception occurred: ' + e)
			throw e;
		}
	}
	
	/**
	 * @abstract Parses a Calibre database
	 * 			 This is the main method to get data from it to be integrated in the Joplin Notebook
	 * 
	 */
	public parse = async function() : Promise<any>
	{
		console.info('Calibre.Parse');
		await this.parent.onStart(this.library_path);

		const genre = await settings.genreField();
		const genre_row = await this.get("SELECT id, label FROM custom_columns WHERE label = ?", [`${genre}`]);
		if (! genre_row)
		{
			throw new Error(`The custom column ${genre} is configured but not present in the Calibre database`);
		}
		const genre_id = genre_row.id;
		console.info(`Genre field #${genre} has id ${genre_id}`);
		this.genre_table = `custom_column_${genre_id}`;
		this.genre_link_table = `books_custom_column_${genre_id}_link`;

		const content = await settings.contentField();
		if (content !== '')
		{
			const content_row = await this.get("SELECT id, label FROM custom_columns WHERE label = ?", [`${content}`]);
			if (! content_row)
			{
				throw new Error(`The custom column ${content} is configured but not present in the Calibre database`);
			}
			const content_id = content_row.id;
			console.info(`Content field #${content} has id ${content_id}`);
			this.content_table = `custom_column_${content_id}`;
		}
		else
		{
			this.content_table = '';
		}
		
		const shrinkGenres = await settings.shrinkGenres();
		console.info(`Shrink genres to ${shrinkGenres}`);
		let genres = await this.all(`SELECT id, value FROM ${this.genre_table} WHERE value LIKE ? ORDER BY value`, [ shrinkGenres ]);
		console.debug(`${genres.length} Genres left`);
		genres = Object.fromEntries(genres.map((row: any) => [row.value, row.id]));
		genres = await this.normalize_genres(genres);
		
		await this.parent.onStop();
		
		return true;
	}


	/**
	 * @abstract Encapsulation of the Sqlite get method
	 * 
	 */
	get = async function(query: string, params: Array<string>) : Promise<any>
	{
		return this.promisify(this.db, this.db.get, query, params);
	}


	/**
	 * @abstract Encapsulation of the Sqlite all method
	 * 
	 */
	all = async function(query: string, params: Array<string>) : Promise<any>
	{
		return this.promisify(this.db, this.db.all, query, params);
	}
	
	/**
	 * @abstract Normalization is the process of inserting missed empty Genre entries
	 *
	 * This method in turn invokes handlers in the Joplin instance and invokes the note
	 * extraction routine.
	 * @param {any} genres - an object with key - val - genre entries
	 * @returns {Promise<any>} - the result object with supplemented entries
	 */
	normalize_genres = async function(genres: any) : Promise<any>
	{
		let result = {};
		let level = 1;
		for (const [key, val] of Object.entries(genres))
		{
			const entries = key.split('.');
			const num_entries = entries.length;
			for (const [idx, sub_entry] of entries.entries())
			{
				const sub_entries = entries.slice(0, idx + 1);
				const joined_sub_entries = sub_entries.join('.');
				if (idx + 1 < num_entries)										// lower parts of genre
				{
					if (! result.hasOwnProperty(joined_sub_entries))			//  -> extend dict
					{
						if (idx + 1 > level)
						{
							level ++;
							this.parent.onIncrease();
						}
						while (idx + 1 < level)
						{
							level --;
							this.parent.onDecrease();
						}
						await this.parent.onBook(idx + 1, sub_entry, -1);
						result[joined_sub_entries] = -1;
					}
				}
				else															// highest part of genre
				{
					while (idx + 1 > level)
					{
						level ++;
						this.parent.onIncrease();
					}
					while (idx + 1 < level)
					{
						level --;
						this.parent.onDecrease();
					}
					await this.parent.onBook(idx + 1, sub_entry, val);
					result[key] = val;
					await this.populate_notes(val);
				}
			}
		}
		while (level > 1)														// bring level back to 1
		{
			level --;
			this.parent.onDecrease();
		}
		
		return result;
	}
	
	
	/**
	 * @abstract Queries the Calibre db for Books belonging to a given Genre.
	 * 
	 * In turn acquires additional book data and invokes the Joplin handler.
	 * @param {number} val - the id of the specific genre the books are to be acquired for
	 */
	populate_notes = async function(val: number) : Promise<void>
	{
		const filterTitles = await settings.filterTitles();
		const books = await this.all(
			`SELECT books.id, books.title, books.path, books.has_cover, books.timestamp, books.last_modified, books.author_sort FROM books ` +
			`INNER JOIN ${this.genre_link_table} AS link ON books.id = link.book ` +
			`WHERE link.value = ? AND books.title LIKE ?`, [val, filterTitles]);
		console.debug(`Books: ${JSON.stringify(books)}`);
		for (let book of books)
		{
			await this.acquire_book_data(book)
			await this.parent.onNote(this.library_path, book);
		}
	}
	

	/**
	 * @abstract Acquires additional book data from the Calibre db
	 * @param {{}} book - the book object
	 */
	async acquire_book_data(book: {}) : Promise<void>
	{
		const convertHtml = await settings.convertHtml();
		const text = await this.get(
			`SELECT text FROM comments WHERE book = ?`, book['id']								// the comments belonging to the book
		);
		let comments = text['text'];
		if (convertHtml)
		{
			comments = (await turndownServices.updateSettings()).turndown(comments);			// conversion depends on setting
		}
		book['comments'] = comments;
		
		if (this.content_table !== '')															// content table configured?
		{
			let content = await this.get(
				`SELECT value FROM ${this.content_table} WHERE book = ?`, book['id']			// the content belonging to the book
			);
			if (content != undefined)
			{
				content = content['value'];
				if (convertHtml)																// if present and conversion configured
				{
					content = turndownServices.turndown(content);
				}
				book['content'] = content;
			}
		}
		
		const data = await this.all(
			`SELECT data.format, data.name FROM data WHERE data.book = ?`, book['id']			// the formats belonging to the book
		);
		const formats = data.map((data: any) => data['format']);
		book['formats'] = formats;
		if (formats.length > 0)
		{
			book['name'] = data[0]['name'];
		}
	}

	
	/**
	 * @abstract Converts a method with given signature and callback to a Promise returning method
	 * 
	 */
	promisify = async function(ob: object, fnc: Function, ...args: any) : Promise<any>
	{
		return new Promise<any>((resolve, reject) =>
		{			
			fnc.bind(ob)(...args, (err: any, result: any) => {
				
			if (err)
			{
				console.error('Error occurred: ' + err)		
				reject(err);
			}
			else
			{
				resolve(result);
			}});
		});
	}


	parent: IEvents;
	library_path: string;
	db_path: string;
	db: any;
	genre_table: string;
	genre_link_table: string;
	content_table: string;
}
