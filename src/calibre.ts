import { IEvents } from './events';
import { settings } from './settings';
import { turndownServices } from './turndownServices';
import { CalibreServices } from './calibreServices';


/**
 * @abstract This class provides an interface to extract information from a Calibre database
 * 
 */
export class Calibre extends CalibreServices
{
	/**
		@abstract Constructor
	*/
	public constructor(parent: IEvents, library_path: string)
	{
		super(library_path);
		console.info(`Calibre.constructor`);
		this.parent = parent;
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

		await this.prepare_custom_columns();
		
		const genre = await settings.genreField();
		const genre_row = await this.cc_meta(genre);
		const genre_id = genre_row.id;
		console.assert(genre_id, `'${genre}' is not a valid genre`);
		console.info(`Genre field #${genre} has id ${genre_id}`);
		this.genre_table = genre_row.table;
		this.genre_link_table = genre_row.link;

		const content = await settings.contentField();
		if (content !== '')
		{
			const content_row = await this.cc_meta(content);
			const content_id = content_row.id;
			console.assert(content_id, `'${content}' is not a valid content field`);
			console.info(`Content field #${content} has id ${content_id}`);
			this.content_table = content_row.table;
		}
		else
		{
			this.content_table = '';
		}
		
		const shrinkGenres = await settings.shrinkGenres();
		console.info(`Shrink genres to ${shrinkGenres}`);
		let genres = await this.genres(this.genre_table, shrinkGenres);
		genres = await this.normalize_genres(genres);
		
		await this.parent.onStop();
		
		return true;
	}

	
	/**
	 * @abstract Normalization is the process of inserting missed empty Genre entries
	 *
	 * This method in turn invokes handlers in the Joplin instance and invokes the note
	 * extraction routine.
	 * 
	 * @param {any} genres 		- an object with key - val - genre entries
	 * @returns {Promise<any>} 	- the result object with supplemented entries
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
	 * 
	 * @param {number} val - the id of the specific genre the books are to be acquired for
	 */
	populate_notes = async function(val: number) : Promise<void>
	{
		const filterTitles = await settings.filterTitles();
		const books = await this.books(this.genre_link_table, val, filterTitles); 
		for (let book of books)
		{
			await this.acquire_book_data(book);
			await this.acquire_custom_columns(book);
			await this.parent.onNote(this.library_path, book);
		}
	}
	

	/**
	 * @abstract Acquires additional book data from the Calibre db
	 * @param {{}} book - the book object
	 */
	async acquire_book_data(book: {}) : Promise<void>
	{
		let comments = await this.comments(book['id']);											// the comments belonging to the book
		if (comments != undefined)
		{
			comments = await this.to_md(comments);												// if present and conversion configured
			book['comments'] = comments;
		}
		
		if (this.content_table !== '')															// content table configured?
		{
			let content = await this.content(this.content_table, book['id']);					// the content belonging to the book
			if (content != undefined)
			{
				content = await this.to_md(content);											// if present and conversion configured
				book['content'] = content;
			}
		}
		
		const data = await this.formats(book['id']);											// the formats belonging to the book
		const formats = data.map((data: any) => data['format']);
		book['formats'] = formats;
		if (formats.length > 0)
		{
			book['name'] = data[0]['name'];
		}
		
		const tags = await this.tags(book['id']); 												// the tags belonging to the book
		book['tags'] = tags;
		
		book['series'] = await this.series(book['id']);											// the series of the book
	}
	
	
	/**
	 * @abstract Prepares configured custom columns for import
	 * 
	 */
	async prepare_custom_columns() : Promise<void>
	{
		this.custom_columns = { };
		for await (const label of settings.eachCustomColumnLabel())							// step 1: get configured columns
		{
			const data = await this.cc_meta(label); 
			this.custom_columns[label] = data;
		}
	}


	/**
	 * @abstract Equips the book data with custom columns info
	 *
	 * @param book 		- the for which to acquire cc 
	 */
	async acquire_custom_columns(book: {}) : Promise<void>
	{
		let custom_column_simple = [ ];
		let custom_column_comments = [ ];
		
		for await (const label of settings.eachCustomColumnLabel())
		{
			const cc_desc = this.custom_columns[label];
			const cc_info = await this.cc_entries(cc_desc, book['id']);
			
			if (cc_desc.datatype == 'comments')
			{
				const cc_value = cc_info;
				if (cc_value != undefined && cc_value.value != undefined)
				{
					custom_column_comments.push({ 
						label: cc_desc.name, 
						value: await this.to_md(cc_value.value) });
				}
			}
			else
			{
				function process(cc_value: any) : any										// processes one item of a custom column
				{																			// we'll get ready values for the table
					if (cc_desc.datatype == 'bool')
					{
						return cc_value ? 'yes' : 'no';
					}
					else if (cc_desc.datatype == 'rating')
					{
						let rating = cc_value;
						if (cc_desc.allow_half_stars)
						{
							rating = cc_value / 2.;
						}
						rating = rating / 5.;
						return `<div class="calibre-rating" rating="${rating}" />`;
					}
					else if (cc_desc.datatype == 'text')
					{
						return cc_value.replace(/(\*|\_)/g, '\\$1');
					}
					return cc_value;
				};
			
				const cc_values =															// all items of one custom column (per one book)
					cc_info
					.filter((cc: any) => cc.value != undefined)
					.map((cc: any) => process(cc.value));									// custom column values as array
				
				const simple_custom_column = { label: cc_desc.name, values: cc_values };
				custom_column_simple.push(simple_custom_column);
			}			
		}
		book['cc_simple'] = custom_column_simple;
		book['cc_comments'] = custom_column_comments;
	}


	/**
	 * @abstract Converts a comments like field to MD (if configured)
	 * 
	 * @param comments 	- comments like field
	 * @returns			- processed field
	 */
	async to_md(comments: string) : Promise<string>
	{
		const convertHtml = await settings.convertHtml();
		if (convertHtml)
		{
			let result = `<div>${comments}</div>`;
			result = (await turndownServices.updateSettings()).turndown(result);			// conversion depends on setting
			return result;
		}
		
		return comments;
	}

	parent: IEvents;
	library_path: string;
	db_path: string;
	db: any;
	genre_table: string;
	genre_link_table: string;
	content_table: string;
	custom_columns: any;
}
