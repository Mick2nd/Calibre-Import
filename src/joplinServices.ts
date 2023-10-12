import joplin from 'api';
import { Path } from 'api/types';
import os = require('os');
const fs = joplin.require('fs-extra');


class JoplinServices
{
	constructor()
	{
		
	}
	
	/**
		@abstract Sets the time values for the next post action
	 */
	set_time = function(created: string, updated: string) : void
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
		@abstract Puts a folder (notebook) entry into Joplin with a POST request
	 */
	put_folder = async function(parent_id: string, title: string) : Promise<any>
	{
        var data = { 'title': title, 'parent_id': parent_id };
		return await this.post(['folders'], { }, data);
	}


	/**
		@abstract Puts a Mark-down note into Joplin with a POST request
	 */
	put_note = async function(parent_id: string, title: string, content: string) : Promise<any>
	{
        var data = { 'title': title, 'body': content, 'parent_id': parent_id };
		return await this.post(['notes'], { }, data);
	}


	/**
		@abstract Puts a resource into Joplin
	 */
	put_resource_by_file = async function(meta_data: any, resource_path: string) : Promise<any>
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
		@abstract Puts a resource into Joplin
	 */
	put_resource = async function(meta_data: any, content: Uint8Array) : Promise<any>
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
		@abstract Creates a tag and assigns it to the given id's note
	 */
	put_tag = async function(note_id: string, name: string) : Promise<any>
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
		const id = tag.id || null;													// TODO: does method exist?
		if (id != null)
		{
			var data2 = { id: note_id };
			return await this.post(['tags', id, 'notes'], { }, data2);
		}
		
		return null;																// TODO: issue warning
	}


	/**
		@abstract Gets the tag with name with a GET request
	 */
	get_tag = async function(name: string) : Promise<any>
	{
        name = name.toLowerCase();
        return await this.search(name, 'tag');
	}


	/**
		@abstract POST request for resources
	*/
	post_resource = async function(meta_data: any, content: Uint8Array) : Promise<any>
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
			console.error('Exception in Joplin.post_resource: ' + e);
			return { id: 'phantasy.pdf', title: title };
		}
	}
	
	/**
	 * @abstract POSTs a resource file to Joplin
	 * 
	 */
	post_resource_by_file = async function(meta_data: any, resource_path: string) : Promise<any>
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
			console.error('Exception in Joplin.post_resource: ' + e);
			throw e;
		}
	}

	
	/**
		@abstract Returns a temp file to be used as resource file
	 */
	get_tmp_file = async function() : Promise<string>
	{
        const tempPath = path.join(os.tmpdir(), 'tmpresource');
		await fs.mkdtemp(tempPath);
		return tempPath;
	}


	/**
		@abstract Gets the resource record(s) (json) with the given title
	*/
	get_resource = async function(title: string) : Promise<any>
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
		@abstract Sends a search to the Data API
	*/
	search = async function(identifier: string, kind: string) : Promise<any>
	{
		var query = { query: identifier, type: kind };
		var response = await this.get(['search'], query);
		return response['items'];
	}
	
	
	/**
		@abstract Method to acquire an access token to the Joplin Data Api
	*/
	acquire_token = async function() : Promise<boolean>
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
		@abstract The get method. Probably we will use the Joplin Api method directly.
	*/
	get = async function(path: Path, query?: any) : Promise<any>
	{
		var response = await joplin.data.get(path, query);
		return response;
	}
	
	/**
		@abstract The post method. Probably we will use the Joplin Api method directly.
	*/
	post = async function(path: Path, query?: any, body?: any, files?: any[]) : Promise<any>
	{
		if (path.length == 1 && body)
		{
			body['user_created_time'] = this.created;
			body['user_updated_time'] = this.updated;
		}
		
		var response = await joplin.data.post(path, query, body, files);

		return response;
	}
	
	/**
		@abstract The put method. Probably we will use the Joplin Api method directly.
	*/
	put = async function(path: Path, query?: any, body?: any, files?: any[]) : Promise<any>
	{
		if (path.length == 2 && body)
		{
			body['user_created_time'] = this.created;
			body['user_updated_time'] = this.updated;
		}
		
		var response = await joplin.data.put(path, query, body, files);

		return response;
	}
	
	/**
	 *	@abstract The delete method. Probably we will use the Joplin Api method directly.
	 */
	delete = async function(path: Path, query?: any) : Promise<void>
	{
		await joplin.data.delete(path, query);
	}
	
	created: number = new Date().valueOf();
	updated: number = new Date().valueOf();
}

export const joplinServices = new JoplinServices();
