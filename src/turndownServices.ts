import { settings } from "./settings";
var turndown = require('turndown');


/**
 * @abstract A Wrapper for the nodejs turndown module. It adds a rule to the turndown instance for insertion
 * 			 of attributes to the target markdown.
 * 
 */
export class TurndownServices
{
	/**
	 * @abstract Constructor
	 * 
	 */
	constructor()
	{
		this.turndownService = turndown.default();

		var turndownPluginGfm = require('joplin-turndown-plugin-gfm')

		// Use the gfm plugin
		var gfm = turndownPluginGfm.gfm
		this.turndownService.use(gfm)

		// Use the table and strikethrough plugins only
		var tables = turndownPluginGfm.tables
		var strikethrough = turndownPluginGfm.strikethrough
		this.turndownService.use([tables, strikethrough])		
		
		this.turndownService.addRule('list', {
			filter: (node: any, options: any) => this.listFilter(node, options),
			replacement: (content: string, node: any, options: any) => this.listReplacement(content, node, options)
		});
		this.turndownService.addRule('table', {
			filter: (node: any, options: any) => this.tableFilter(node, options),
			replacement: (content: string, node: any, options: any) => this.tableReplacement(content, node, options)
		});
	}
	
	/**
	 * @abstract Queries the actication setting for attributes rule.
	 * 
	 */
	public async updateSettings() : Promise<TurndownServices>
	{
		this.insertAttributes = await settings.insertAttributes();
		return this;
	}
	
	/**
	 * @abstract The turndown method
	 * 
	 */
	public turndown(html: string) : string
	{
		return this.turndownService.turndown(html);
	}
	
	/**
	 * @abstract Tables without head or tables with alignment need extra handling
	 * 
	 */
	tableFilter(node: any, options: any) : boolean
	{
		if (this.skipTable)
		{
			this.skipTable = false;
			return false;
		}
		if (node.nodeName === 'TABLE')
		{
			// if (node.firstElementChild.nodeName !== 'THEAD')				// TODO: remove
			return true;													// requires extra handling
		}
		
		return false;
	}
	

	/**
	 * @abstract Performs the replacement of the TABLE filter
	 */	
	tableReplacement(content: string, node: any, options: any) : string
	{
		this.skipTable = true;
		const align = this.inspectTable(node);
		let table = this.turndown(node.outerHTML);
		table = this.applyAlign(table, align);
		if (this.insertAttributes)
		{
			table = '///attributes:class=calibre-embedded-table\n' + table;
		}
		return table;
	}
	
	
	/**
	 * @abstract Inspects a table for alignment attributes and returns them
	 * 
	 */
	inspectTable(node: any) : any
	{
		let alignment = [];
		console.assert(node.nodeName === 'TABLE');

		const tr = node.firstElementChild.firstElementChild;
		console.assert(tr.nodeName === 'TR');
		for (const td of tr.childNodes)
		{
			console.assert(td.nodeName === 'TD');
			let p = td;
			if (td.firstElementChild !== undefined)
			{
				p = td.firstElementChild;
			}
			
			if (p.attributes.align !== undefined)
			{
				alignment.push(p.attributes.align.nodeValue);
			}
			else
			{
				alignment.push('left');
			}
		}
		
		return alignment;
	}

	/**
	 * @abstract Applies alignment to table columns as part of table handling
	 * 			 The second line of the markdown is modified
	 */	
	applyAlign(table: string, align: []) : string
	{
		let rows = table.split('\n');
		for (let r = 0; r < rows.length; r++)
		{
			let columns = rows[r].split('|');
			for (let c = 1; c < columns.length; c++)
			{
				columns[c] = columns[c].trim();
			
				if (r === 1)
				{
					if (align[c - 1] === 'left')
					{
						columns[c] = ':' + columns[c];
					} 
					if (align[c - 1] === 'right')
					{
						columns[c] = columns[c] + ':';
					} 
				}
			}
			rows[r] = columns.join('|');
		}
		
		return rows.join('\n');
	}
	
	
	/**
	 * @abstract Filter for the list rule
	 * 
	 */
	listFilter(node: any, options: any) : boolean
	{
		if (! this.insertAttributes)
		{
			return false;
		}
		if (this.skip)
		{
			this.skip = false;
			return false;
		}
		if ((node.nodeName === 'OL' || node.nodeName === 'UL') && node.attributes.length > 0)
		{
			return true;
		}
		return false;
	}
	
	/**
	 * @abstract Replacement for the list rule
	 * 
	 */
	listReplacement(content: string, node: any, options: any) : string
	{
		let attributes: any[] = [];
		for (const attr of node.attributes)
		{
			attributes.push(attr);
		}
		attributes = attributes.map((attr: any) => `${attr.nodeName}=${attr.nodeValue}`);
		const entry = `///attributes:${attributes.join(',')}\n`;
		this.skip = true;
		return entry + this.turndown(node.outerHTML);
	}
	
	turndownService: any;
	skip: boolean = false;
	skipTable: boolean = false;
	insertAttributes:boolean = true;
}

export const turndownServices = new TurndownServices();
