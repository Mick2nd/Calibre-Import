const path = require('path');
const { DataExchangeNs } = require('./dataExchange');


module.exports = 
{
	default: function(context: any) : any 
	{
		const pluginId = context.pluginId;
		const indicator = '///attributes';
		let dataExchange = undefined;
		
		console.dir(context);
		console.info(`${pluginId} : Here in Plugin default (OUTER) function`);
		
		
		/**
		 *	This is a default attributes renderer
		 *	It will be invoked, if no other attributes renderer can be acquired (according to demo code) 
		 */
		const defaultAttributesRender = function(tokens: any, idx: any, options: any, env: any, self: any) : any 
		{
			console.info(`${pluginId} : Here in Plugin (defaultAttributesRender) function`);
			return self.renderToken(tokens, idx, options, env, self);
		};


		/**
		 *	@abstract The renderIt function
		 *
		 *	Will be invoked every time an attributes token is detected
		 *
		 */
		function renderIt(originalStyleRender: any, ...args: any) : any
		{
			// arguments: tokens: any, idx: any, options: any, env: any, self: any
			let tokens = args[0], 
				idx = args[1], 
				options = args[2], 
				env = args[3], 
				renderer = args[4];
			
			let token = tokens[idx];
			console.debug(`${pluginId} : Attributes Render token info : ${token.info}`);
			if (token.info.includes(indicator)) 													// modification only for list-styling fence
			{
				try
				{
					let attrs = token.attrs;
					let nextToken = tokens[idx + 1];
					console.debug(`${pluginId} : ${nextToken.type}`);
					if (['bullet_list_open', 'ordered_list_open', 'paragraph_open', 
						'blockquote_open', 'fence'].includes(nextToken.type))						// TODO: supplement
					{
						nextToken.attrs = attrs;
					}
					return '';																		// no own output !
				}
				catch(e)
				{
					console.error(`${pluginId} : ${e}`);											// in error case display error in rendered pane as this can happen with JSON 
					return '<p style="color: red;">' + `${e}` + '</p>';
				}
			}
			
			return '';		
			// return originalStyleRender(...arguments);											// then invoke the original render function
		}
		
		/**
		 * @abstract Provides attributes from a attributes token to the next token
		 * 
		 */
		function addAttributes(token: any, content: string)
		{
			let attrs = content.substring(content.search(':') + 1);
			token.attrs = attrs.split(',').map((asn: string) => asn.split('='));
		}
		
		/**
		 * @abstract Tokenizes the attributes in the source
		 * 
		 */
		function tokenizeAttributes(state: any, start: number, end: number, silent: boolean)
		{
		    let curLine = state.line;
		    let pos = state.bMarks[curLine] + state.tShift[curLine],
		    	max = state.eMarks[curLine];

			let line = state.src.slice(pos, max);
			console.debug(`${pluginId} : ${state.line} : ${state.bMarks[curLine]} : ${state.tShift[curLine]} : ${state.eMarks[curLine]} : ${line}`);
			
			let pos2 = line.search(indicator);
			if (pos2 !== 0)
			{
				/*
				*/
				const length = state.tokens.length;															// second algorithm for nested lists
				if (length > 1)
				{
					let lastToken = state.tokens[length - 2];
					if (lastToken.type === 'inline')														// last token == inline token ?
					{
						let content = lastToken.content.split('\n');
						console.debug(`${pluginId} : Found inline token : ${JSON.stringify(content)}`);
						if (content.length >= 2 && content[1].includes(indicator))							// detection of these kinds of attributes
						{
							console.debug(`${pluginId} : Performing Attributes post handling`);

							lastToken.content = content[0];													// rewrite content
							const attributes = content[1];

							let token = state.push('attributes', 'div', 0);									// and add new token
							token.info = attributes;
							addAttributes(token, attributes);
						}
					}							
				}
				return false;
			}
			if (silent)
			{
				return true;
			}

			console.debug(`${pluginId} : Token detected`);
			let token = state.push('attributes', 'div', 0);
			token.info = line;
			addAttributes(token, line);

		    // We use to render markdown within
		    // state.md.block.tokenize(state, curLine + 1, end, false);

			state.line ++;			
			
			return true;
		}
		

		return {
			/**
			 * @abstract The real plugin
			 * 
			 */
			plugin: function(markdownIt: any, ruleOptions: any)
			{	
				
				console.dir(ruleOptions);
				console.info(`${pluginId} : Here in Plugin (INNER) function : ${ruleOptions.resourceBaseUrl}`);
				
				markdownIt.block.ruler.before('list', 'attributes', tokenizeAttributes, 
					{alt: ['list', 'paragraph', 'reference', 'blockquote', 'fence']});

				dataExchange = DataExchangeNs.DataExchange.fromScript(pluginId, ruleOptions.resourceBaseUrl, markdownIt.block.ruler);
				
				const attributesRender = markdownIt.renderer.rules.attributes;
				const originalAttributesRender = attributesRender || defaultAttributesRender;

				markdownIt.renderer.rules.attributes = function(...args: [any]) : any 				/// replacement for ATTRIBUTES rule (if any)
				{						
					return renderIt(originalAttributesRender, ...args);
				};
			},
			
			assets: function() : any {
				return [
					// { name: 'markdownIt.css' }
				];
			},
		}
	}
}
