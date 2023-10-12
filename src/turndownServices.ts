import { settings } from "./settings";

var turndown = require('turndown');


export class TurndownServices
{
	constructor()
	{
		this.turndownService = turndown.default();
		this.turndownService.addRule('list', {
			filter: (node: any, options: any) => this.filter(node, options),
			replacement: (content: string, node: any, options: any) => this.replacement(content, node, options)
		});
	}
	
	public async updateSettings() : Promise<TurndownServices>
	{
		this.insertAttributes = await settings.insertAttributes();
		return this;
	}
	
	public turndown(html: string) : string
	{
		return this.turndownService.turndown(html);
	}
	
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
		if (node.nodeName === 'OL' && node.attributes.length > 0)
		{
			console.debug(`Ordered list with styles: ${node.attributes['style'].nodeValue}`);
			console.dir(node);
			return true;
		}
		return false;
	}
	
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
