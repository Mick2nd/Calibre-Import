import joplin from 'api';


/**
 * @abstract This class provides an interface to extract information from a Calibre database
 * 
 */
export class CalibreServices
{
	/**
	 * @abstract Constructor. Opens a Calibre db.
	 * 
	 * @param library_path	- the folder where the db file resists		  		
	 */
	public constructor(library_path: string)
	{
		try
		{
			const path = require('path');
			const sqlite = joplin.require('sqlite3');
			const fs = joplin.require('fs-extra');

			console.info(`Calibre`);
			this.library_path = library_path;
			this.db_path = path.join(library_path, 'metadata.db');
			if (fs.existsSync(this.db_path))
			{
				this.db = new sqlite.Database(this.db_path, sqlite.OPEN_READONLY) /* sqlite.OPEN_READWRITE */
			}
			else
			{
				throw new Error('Calibre Db file not found');
			}
		}
		catch(e)
		{
			console.error('Exception occurred: ' + e);
			throw e;
		}
	}
	
	
	/**
	 * @abstract Extracts the complete Genre list from the Calibre databse, solving a given pattern.
	 * 
	 * @param table		- Genre table name
	 * @param pattern	- pattern to be solved by genre name
	 * @returns			- name - id dict of the genres
	 */
	async genres(table: string, pattern: string) : Promise<any>
	{
		let genres = await this.all(`SELECT id, value FROM ${table} WHERE value LIKE ? ORDER BY value`, [ pattern ]);
		genres = Object.fromEntries(genres.map((row: any) => [row.value, row.id]));
		return genres;		
	}
	
	
	/**
	 * @abstract Extracts a list of Books belonging to a given Genre, solving a given pattern
	 * 
	 * @param genre_link_table	- Genre table name
	 * @param genre_id			- the Genre id
	 * @param pattern			- pattern to be solved by Book title
	 * @returns					- the book list
	 */
	async books(genre_link_table: string, genre_id: number, pattern: string) : Promise<any>
	{
		const books = await this.all(
			`SELECT books.id, books.title, books.path, books.has_cover, books.timestamp, books.last_modified, books.author_sort FROM books ` +
			`INNER JOIN ${genre_link_table} AS link ON books.id = link.book ` +
			`WHERE link.value = ? AND books.title LIKE ?`, [`${genre_id}`, pattern]);
		return books;		
	}
	
	
	/**
	 * @abstract Returns the comments field for a given book
	 * 
	 * @param book_id	- Book id
	 * @returns			- the text field
	 */
	async comments(book_id: number) : Promise<string | undefined>
	{
		const row = await this.get(`SELECT text FROM comments WHERE book = ?`, [`${book_id}`]);		// the comments belonging to the book
		if (row != undefined && row.text != undefined)
		{
			return row['text'];
		}
		
		return undefined;
	}
	
	
	/**
	 * @abstract Returns the content (custom) field for a given book
	 * 
	 * @param book_id	- Book id
	 * @returns			- the comments like field
	 */
	async content(table: string, book_id: number) : Promise<string | undefined>
	{
		const row = await this.get(`SELECT value FROM ${table} WHERE book = ?`, [`${book_id}`]);	// the content belonging to the book
		if (row != undefined && row.value != undefined)
		{
			return row['value'];
		}
		
		return undefined;
	}
	
	
	/**
	 * @abstract Returns the formats for a given book
	 * 
	 * @param book_id	- Book id
	 * @returns			- formats
	 */
	async formats(book_id: number) : Promise<any>
	{
		const data = await this.all(
			`SELECT data.format, data.name FROM data WHERE data.book = ?`, [`${book_id}`]			// the formats belonging to the book
		);
		if (data == undefined)
		{
			return [];
		}
		return data;
	}
	
	
	/**
	 * @abstract Returns the tags for a given book
	 * 
	 * @param book_id	- Book id
	 * @returns			- tags
	 */
	async tags(book_id: number) : Promise<any>
	{
		const tag_data = await this.all( 															// the tags belonging to the book
			`SELECT tags.name FROM tags
			INNER JOIN books_tags_link AS link ON tags.id = link.tag 
			WHERE link.book = ?`, [`${book_id}`]
		);
		const tags = tag_data.map((data: any) => data['name'].toLowerCase());
		return tags;		
	}
	
	
	/**
	 * @abstract Extracts series information from the Calibre database for a given book.
	 * 
	 * @param book_id	- the id field of the book in the database
	 * @returns			- the series info as to be displayed in Joplin
	 */
	async series(book_id: number) : Promise<string>
	{
		const sql = 
			`SELECT books.id, series.name AS series, books.series_index AS idx FROM books
			 INNER JOIN books_series_link AS link ON books.id = link.book
			 INNER JOIN series ON series.id = link.series 
			 WHERE books.id = ?`;

		const row = await this.get(sql, [`${book_id}`]);
		console.dir(row);
		if (row != undefined && row.series != undefined && row.idx != undefined)
		{
			return `${row.series} : ${row.idx}`;
		}
		return '';
	}


	/**
	 * @abstract Given a custom column label, this function reads the custom column info from the
	 * 			 database and returns it enriched by the table names. 
	 * 
	 * @param label	- the label of the custom column to search for
	 * @returns		- custom column info including table names used by the custom column
	 */
	async cc_meta(label: string) : Promise<any>
	{
		let row = await this.get(
			`SELECT id, label, name, datatype, is_multiple, normalized, display 
			FROM custom_columns WHERE label = ?`, [label]);
		if (! row)
		{
			throw new Error(`The custom column '${label}' is configured but not present in the Calibre database`);
		}
		const id = row.id;
		row.table = `custom_column_${id}`;												// table names are added
		if (row.normalized)
		{
			row.link = `books_custom_column_${id}_link`;
		}
		const display = JSON.parse(row.display);										// display entries are merged
		row = Object.assign(row, display);
		
		return row;
	}
	
	
	/**
	 * @abstract Given a custom column metadata, this function reads the custom column entries
	 * 			 for a given book.
	 * 
	 * @param cc_desc 	- custom column metadata
	 * @param book_id 	- Book id
	 */
	async cc_entries(cc_desc: any, book_id: number) : Promise<any>
	{
		const cc_table = cc_desc.table;
		const cc_link_table = cc_desc.link;
		let sql = '';
		if (cc_desc.normalized)															// first prepare sql statement
		{
			sql = 
				`SELECT cc.value FROM ${cc_table} AS cc
				INNER JOIN ${cc_link_table} AS link ON cc.id = link.value 
				WHERE link.book = ?`;				
		}
		else // data per custom_column_#
		{
			sql = `SELECT value FROM ${cc_table} WHERE book = ?`;				
		}
		
		if (cc_desc.datatype == 'comments')
		{
			return await this.get(sql, [ `${book_id}` ]);								// comments can be only one per custom column and book
		}
		else
		{
			return await this.all(sql, [ `${book_id}` ]);								// all items of one custom column (per one book)
		}		
	}
	
	
	/**
	 * @abstract Prepares all custom columns for settings configuration
	 * 
	 * @returns		- custom column info as id-label-dict
	 */
	async custom_columns() : Promise<any>
	{
		const cc_entries = { };
		cc_entries[0] = 'Unassigned';
		
		const custom_columns = await this.all(
			`SELECT id, label, name, datatype, is_multiple, normalized FROM custom_columns ORDER BY id`);
		for (const row of custom_columns)
		{
			cc_entries[row.id] = row.label;
		}
		
		return cc_entries;
	}


	/**
	 * @abstract Encapsulation of the Sqlite get method
	 * 
	 */
	async get(query: string, params: Array<string>) : Promise<any>
	{
		return this.promisify(this.db, this.db.get, query, params);
	}


	/**
	 * @abstract Encapsulation of the Sqlite all method
	 * 
	 */
	async all(query: string, params: Array<string> = []) : Promise<any>
	{
		return this.promisify(this.db, this.db.all, query, params);
	}
	

	/**
	 * @abstract Runs a SQL statement not returning any data like delete
	 * 
	 */
	async run(query: string, params: Array<string> = []) : Promise<void>
	{
		this.promisify(this.db, this.db.run, query, params);
	}

	
	/**
	 * @abstract Converts a method with given signature and callback to a Promise returning method
	 * 
	 */
	async promisify(ob: object, fnc: Function, ...args: any) : Promise<any>
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


	library_path: string;
	db_path: string;
	db: any;
}
