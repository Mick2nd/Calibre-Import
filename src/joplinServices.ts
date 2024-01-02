import joplin from 'api';
import { Path } from 'api/types';
import os = require('os');
import path = require('path');
const fs = joplin.require('fs-extra');


/**
 * @abstract An encapsulation of the Joplin Data API as neeeded by this app.
 * 
 */
export class JoplinServices
{
	/**
	 * @abstract Constructor
	 * 
	 */
	constructor()
	{
		
	}
	
	/**
	 * @abstract Sets the time values for the next post action
	 *
	 * @param created - created time to be used	
	 * @param updated - updated time to be used	
	 */
	set_time(created: string, updated: string) : void
	{
		if (! created.endsWith('+00:00'))
		{
			created += '+00';
			updated += '+00';
		}
		this.created = (new Date(created)).valueOf();
		this.updated = (new Date(updated)).valueOf();
	}


	/**
	 * @abstract Puts a folder (notebook) entry into Joplin with a POST request
	 * 
	 * @param parent_id - id of the parent
	 * @param title 	- title of the notebook to be created
	 */
	async put_folder(parent_id: string, title: string) : Promise<any>
	{
        var data = { 'title': title, 'parent_id': parent_id };
		return await this.post(['folders'], { }, data);
	}


	/**
	 * @abstract Puts a Mark-down note into Joplin with a POST request
	 * 
	 * @param parent_id - id of the parent notebook
	 * @param title 	- title of the note
	 * @param content 	- the body of the note
	 */
	async put_note(parent_id: string, title: string, content: string) : Promise<any>
	{
        var data = { 'title': title, 'body': content, 'parent_id': parent_id };
		return await this.post(['notes'], { }, data);
	}


	/**
	 * @abstract Puts a resource into Joplin. Before POSTing this method tries to acquire a reference
	 * 			 to an existing resource by using its title.
	 * 
	 * @param meta_data 	- meta data containing the title of the resource
	 * @param resource_path - the path to an existing resource, image or other file
	 */
	async put_resource_by_file(meta_data: any, resource_path: string) : Promise<any>
	{
        var title = meta_data['title'];
        var resp = await this.get_resource(title);
        var size = (await fs.stat(resource_path)).size;
		for (var item of resp)
		{
			if (item['size'] == size)
			{
				return item;
			}
		}
		
		return await this.post_resource_by_file(meta_data, resource_path);
	}


	/**
	 * @abstract Puts a resource into Joplin. Before POSTing this method tries to acquire a reference
	 * 			 to an existing resource by using its title.
	 * 
	 * @param meta_data - meta data containing the title of the resource
	 * @param content 	- the content of the resource as binary array
	 */
	async put_resource(meta_data: any, content: Uint8Array) : Promise<any>
	{
        var title = meta_data['title'];
        var resp = await this.get_resource(title);
		for (var item of resp)
		{
			if (item['size'] == content.length)
			{
				return item;
			}
		}
		
		return await this.post_resource(meta_data, content);
	}


	/**
	 * @abstract Creates a tag and assigns it to the given id's note.
	 * 
	 * If the tag already exists, this tag will be used.
	 * 
	 * @param note_id 	- the note's id to which the tag is to be ssigned
	 * @param name 		- the tag name
	 */
	async put_tag(note_id: string, name: string) : Promise<any>
	{
		var tag = await this.get_tag(name);
		if (tag.length > 0)
		{
			tag = tag[0]; 
		} 
		else
		{
			var data = { title: name };
			tag = await this.post(['tags'], { }, data);
		}
		const id = tag.id || null;
		if (id != null)
		{
			var data2 = { id: note_id };
			return await this.post(['tags', id, 'notes'], { }, data2);
		}
		
		console.warn(`Tag '${name}' not assignable to note`);
		return null;
	}


	/**
	 * @abstract Gets the tag with name with a GET request by using SEARCH.
	 * 
	 * @param name - the tag name to be searched
	 */
	async get_tag(name: string) : Promise<any>
	{
        name = name.toLowerCase();
        return await this.search(name, 'tag');
	}


	/**
	 * @abstract POST request for resources
	 * 
	 * Before posting a temp file will be created because Joplin can only work with files.
	 * 
	 * @param meta_data - meta data containing the title
	 * @param content 	- the content of the resource as binary array
	 */
	async post_resource(meta_data: any, content: Uint8Array) : Promise<any>
	{
		try
		{
			const tmp_file = await this.get_tmp_file();
			await fs.writeFile(tmp_file, content);
		
	        var title = meta_data['title'];
			var data = [{ path: tmp_file }]
			var resp = await this.post(['resources'], { }, meta_data, data);
			
			await fs.remove(tmp_file);
		
			return resp;
		}
		catch (e)
		{
			console.error(`Exception in Joplin.post_resource of '${title}': ${e}`);
			throw e;
		}
	}
	
	/**
	 * @abstract POSTs a resource file to Joplin
	 * 
	 * @param meta_data 	- meta data containing the title
	 * @param resource_path - the file system path of an existing resource
	 */
	async post_resource_by_file(meta_data: any, resource_path: string) : Promise<any>
	{
		try
		{
	        var title = meta_data['title'];
			var data = [{ path: resource_path }]
			var resp = await this.post(['resources'], { }, meta_data, data);
		
			return resp;
		}
		catch (e)
		{
			console.error(`Exception in Joplin.post_resource of '${title}': ${e}`);
			throw e;
		}
	}

	
	/**
	 * @abstract Returns a temp file to be used as resource file
	 * 
	 * @returns a temp file path located in the os' temp folder
	 */
	async get_tmp_file() : Promise<string>
	{
        const tempPath = path.join(os.tmpdir(), 'tmpresource');
		await fs.mkdtemp(tempPath);
		return tempPath;
	}


	/**
	 * @abstract Gets the resource record(s) (json) with the given title. The resources are equipped
	 * 			 with 'id' and 'size' fields
	 * 
	 * @param title - the title of a resource
	 */
	async get_resource(title: string) : Promise<any>
	{
		var lst = [];
		var query = { fields: 'id,size'};
		
		for (var item of await this.search(title, 'resource'))
		{
			try
			{
				var response = await this.get(['resources', item.id], query);
				lst.push(response);
			}
			catch (e)
			{
				console.error(`Exception in get_resource ${e}`);
				throw e;
			}
		}
		return lst;
	}

	
	/**
	 * @abstract Sends a search to the Data API. Probably this request should be improved to make 
	 *			 use of the page property. NOT USED BY joplinData.
	 *
	 * @param identifier 	- the identifier of the item(s) to be searched
	 * @param kind 			- kind of items (notes, resources..)
	 * @returns 			- the result of the search
	 */
	async search(identifier: string, kind: string) : Promise<any>
	{
		var query = { query: identifier, type: kind };
		
		const response = await this.get(['search'], query);								// TODO: work with 'all' enumerators
		return response['items'];														// TODO: test, handleError already in get
		
		// const response = this.get(['search'], query);
		// return (await this.handleError(response, 'search(get)'))['items'];
	}
	
	
	/**
	 * @abstract Method to acquire an access token to the Joplin Data Api
	 *			 Obsolete.
	 */
	async acquire_token() : Promise<boolean>
	{
		const query = await joplin.data.post(['auth']);
		var response = {};
		do
		{
			response = await joplin.data.get(['auth', 'check'], query);
		}
		while(response['status'] == 'waiting');
		if (response['status'] == 'accepted')
		{
			this.token = response['token'];
			return true;
		}
		else
		{
			return false;
		}
	}
	
	/**
	 * @abstract Asynchronous Iterator through a collection of Joplin data delivering chunks
	 * 
	 * This uses the page and has_more properties to retrieve the whole collection addressed by the 
	 * request.
	 * 
	 * @param path 	- the Joplin Data path parameter
	 * @param query - the Joplin Data query parameter (optional)
	 */
	async *allChunks(path: string[], options?: any) : AsyncGenerator<[]>
	{
		let done = false;
		let optionsCopy = { };
		if (options)
		{
			optionsCopy = Object.assign({}, options);									// prepare an options shallow copy
		}
		
		for (let page = 1; !done; page++)
		{
			optionsCopy['page'] = page;													// prepare page option
			let response = await this.get(path, optionsCopy);							// retrieve the page
			yield await Promise.resolve(response.items);								// yield

			done = ! response.has_more;
		}
	}
	
	/**
	 * @abstract Asynchronous Iterator through a collection of Joplin data
	 * 
	 * This uses the page and has_more properties to retrieve the whole collection addressed by the 
	 * request.
	 *
	 * @param path 	- the Joplin Data path parameter
	 * @param query - the Joplin Data query parameter (optional)
	 */
	async *all(path: string[], options?: any) : AsyncGenerator
	{
		for await(const items of this.allChunks(path, options))
		{
			for (const item of items)
			{
				yield await Promise.resolve(item);										// yield
			}
		}
	}
	
	/**
	 *	@abstract The get method. Probably we will use the Joplin Api method directly.
	 *
	 *  This retrieves content from Joplin resource(s)
	 * 
	 * 	@param path 	- the Joplin Data path parameter
	 * 	@param query 	- the Joplin Data query parameter (optional)
	 */
	async get(path: Path, query?: any) : Promise<any>
	{
		const response = joplin.data.get(path, query);
		return await this.handleError(response, 'get');
	}
	
	/**
	 *	@abstract The post method. Probably we will use the Joplin Api method directly.
	 *
	 *  This sends content of new resource(s). If the method addresses a single Note, the body
	 *  data is supplemented by the creation und updated times.
	 *
	 * 	@param path 	- the Joplin Data path parameter
	 * 	@param query 	- the Joplin Data query parameter (optional)
	 *  @param body 	- the Joplin Data body parameter (optional) 
	 *  @param files 	- the Joplin Data files parameter (optional) 
	 */
	async post(path: Path, query?: any, body?: any, files?: any[]) : Promise<any>
	{
		if (path.length == 1 && body)
		{
			body['user_created_time'] = this.created;
			body['user_updated_time'] = this.updated;
		}
		
		const response = joplin.data.post(path, query, body, files);
		return await this.handleError(response, 'post');
	}
	
	/**
	 *	@abstract The put method updates content of existing resource(s).
	 *
	 *  If the method addresses a single Note, the body data is supplemented by the creation und updated
	 *  times.
	 *
	 * 	@param path 	- the Joplin Data path parameter
	 * 	@param query 	- the Joplin Data query parameter (optional)
	 *  @param body 	- the Joplin Data body parameter (optional) 
	 *  @param files 	- the Joplin Data files parameter (optional) 
	*/
	async put(path: Path, query?: any, body?: any, files?: any[]) : Promise<any>
	{
		if (path.length == 2 && body)
		{
			body['user_created_time'] = this.created;
			body['user_updated_time'] = this.updated;
		}
		
		const response = joplin.data.put(path, query, body, files);
		return await this.handleError(response, 'put');
	}
	
	/**
	 *	@abstract The delete method. Probably we will use the Joplin Api method directly.
	 *
	 * 	@param path 	- the Joplin Data path parameter
	 * 	@param query 	- the Joplin Data query parameter (optional)
	 */
	async delete(path: Path, query?: any) : Promise<void>
	{
		const response = joplin.data.delete(path, query);
		await this.handleError(response, 'delete');
	}
	
	/**
	 * @abstract Can be used to handle error from Joplin Data API. Throws if response contains
	 * 			 error info, otherwise returns the response parameter.
	 * 
	 * @param resp 	- the reponse to check for errors (a Promise)
	 * @param api 	- the api that caused the error
	 * @returns 	- the method parameter
	 * @throws throws on error response
	 */
	async handleError(resp: Promise<any>, api: string) : Promise<any>
	{
		const resp2 = await resp;
		if (resp2 && resp2.hasOwnProperty('error'))
		{
			throw new Error(`Error in Jopli Data request ${api} '${resp2.error}'`);
		}
		
		return resp2;
	}
	
	created: number = new Date().valueOf();
	updated: number = new Date().valueOf();
	token: any;
}

export const joplinServices = new JoplinServices();
