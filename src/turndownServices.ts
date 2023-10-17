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
		this.turndownService.addRule('list', {
			filter: (node: any, options: any) => this.filter(node, options),
			replacement: (content: string, node: any, options: any) => this.replacement(content, node, options)
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
	 * @abstract Filter for the list rule
	 * 
	 */
	filter(node: any, options: any) : boolean
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
			console.debug(`Ordered list with styles: ${node.attributes['style'].nodeValue}`);
			console.dir(node);
			return true;
		}
		return false;
	}
	
	/**
	 * @abstract Replacement for the list rule
	 * 
	 */
	replacement(content: string, node: any, options: any) : string
	{
		let attributes: any[] = [];
		for (const attr of node.attributes)
		{
			attributes.push(attr);
		}
		console.dir(attributes);
		attributes = attributes.map((attr: any) => `${attr.nodeName}=${attr.nodeValue}`);
		const entry = `///attributes:${attributes.join(',')}\n`;
		this.skip = true;
		return entry + this.turndown(node.outerHTML);
	}
	
	turndownService: any;
	skip: boolean = false;
	insertAttributes:boolean = true;
}

export const turndownServices = new TurndownServices();
