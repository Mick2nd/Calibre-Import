import { Settings } from "./scriptSettings";


module.exports = 
{
	default: function(context: any) : any 
	{
		const pluginId = context.pluginId;
		const indicator = '///attributes';
		const htmlIndicator = 'purehtml';
		
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
		 *	This is a default fence renderer
		 *	It will be invoked, if no other fence renderer can be acquired (according to demo code) 
		 */
		const defaultFenceRender = function(tokens: any, idx: any, options: any, env: any, self: any) : any 
		{
			console.info(`${pluginId} : Here in Plugin (defaultFenceRender) function`);
			return self.renderToken(tokens, idx, options, env, self);
		};


		/**
		 *	@abstract The renderIt function
		 *
		 *	Will be invoked every time an attributes token is detected. This modifies succeeding tokens.
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
			if (token.info.includes(indicator)) 													// modification only for list-styling fence
			{
				try
				{
					let attrs = token.attrs;
					let nextIdx = idx + 1;
					if (nextIdx >= tokens.length)
					{
						return '';
					}
					let nextToken = tokens[nextIdx];
					nextIdx ++;
					
					if (['bullet_list_open', 'ordered_list_open', 'paragraph_open', 
						'blockquote_open', 'heading_open', 'table_open', 'hr', 'fence', 
						'td_open', 'th_open']
						.includes(nextToken.type))													// TODO: supplement
					{
						for (const attr of attrs)
						{
							nextToken.attrPush(attr);
						}
						console.log(`${pluginId}: '${nextToken.tag}' equipped with '${JSON.stringify(attrs)}'`);
					}
					return '';																		// no own output !
				}
				catch(e)
				{
					console.error(`${pluginId} : ${e}`);											// in error case display error in rendered pane as this can happen with JSON 
					return '<p style="color: red;">' + `${e}` + '</p>';
				}
			}
			
			return '';																				// we have EXCLUSIVE access to attributes render
			// return originalStyleRender(...arguments);											// then invoke the original render function
		}
		
		/**
		 * @abstract The renderItFence hook
		 * 
		 */
		function renderItFence(originalFenceRender: any, ...args: any) : any
		{
			let tokens = args[0], 
				idx = args[1], 
				options = args[2], 
				env = args[3], 
				renderer = args[4];
			
			let token = tokens[idx];										// used to render a fence as pure html
			
			if (token.info == htmlIndicator)
			{
				return token.content;
			}
			
			let result = originalFenceRender(...args);						// render a fence
			result = transferAttributes(token.attrs, result);				// and equip the surrounding div with attributes
			
			return result;
		}
		
		/**
		 * @abstract Taking the attributes of a fence token, this function sets the attributes of the
		 *           rendered <pre> html tag.
		 */
		function transferAttributes(attrs: any, content: string) : string
		{
			let attrString = '';
			if (attrs)
			{
				attrString = attrs.map(function(attr: any)
					{
						if (attr[0] !== 'class')
						{
							return `${attr[0]}="${attr[1]}"`;
						}
						else
						{
							return `${attr[0]}="hljs ${attr[1]}"`;
						} 
					}).join(' ');
			}
				
			return content.replace(
				/class="hljs"/smg,
				(match: string, offset: any, whole: any) =>
				{ 
					return attrString;
				}
			);
		}
		
		/**
		 * @abstract Provides attributes from an attributes token to the next token
		 * 
		 */
		function addAttributes(token: any, content: string)
		{
			let attrs = content.substring(content.search(':') + 1);
			for (const attr of attrs.split(','))
			{
				token.attrJoin(...attr.trim().split('='));
			}
		}
		
		/**
		 * @abstract Tokenizes the attributes in the source (attributes tokenizer)
		 * 
		 *	TODO: improve exception handling
		 */
		function tokenizeAttributes(state: any, start: number, end: number, silent: boolean)
		{
			if (state.level == 0)
			{
				state.level ++;
				state.md.block.tokenize(state, start, end, silent);									// assumption: complete tokenization at level 1
				postProcessLists(state);
				postProcessTables(state);
				console.info('Document processed');
				
				return true;
			}
			
		    let curLine = state.line;
		    let pos = state.bMarks[curLine] + state.tShift[curLine],
		    	max = state.eMarks[curLine];

			let line = state.src.slice(pos, max);
			let pos2 = line.search(indicator);
			if (pos2 !== 0) { return false; }
				
			if (silent) { return true; }

			let token = state.push('attributes', 'div', 0);
			token.info = line;
			addAttributes(token, line);

			state.line ++;			
			
			return true;
		}

		/**
		 * @abstract Processes embedded (nested) lists after the tokenizer was run.
		 * 
		 */		
		function postProcessLists(state: any)
		{
			for (const tokens of enumTokenSequence(state, [ 'list_item_open', 'paragraph_open', 'inline', 'paragraph_close' ]))
			{
				let inlineToken: any = tokens.inlineToken;
				const idx = tokens.index;
				let content = inlineToken.content.split('\n');

				if (content.length >= 2 && content[1].includes(indicator))								// detection of these kinds of attributes
				{
					inlineToken.content = content[0];													// rewrite content
					const attributes = content[1];

					let token = new state.Token('attributes', 'div', 0);								// and create new token
					token.info = attributes;
					addAttributes(token, attributes);
					state.tokens.splice(idx + 4, 0, token);												// insert after p
				}
			}
		}
		
		/**
		 * @abstract Processes embedded (nested) table items after the tokenizer was run.
		 * 
		 */		
		function postProcessTables(state: any)
		{
			/**
			 * @abstract Handles a single table item
			 * 
			 */
			function handleTableItem(state: any, tokens: any)
			{
				let inlineToken: any = tokens.inlineToken;												// inline token - one liner
				const idx = tokens.index;

				const content = inlineToken.content.replace(
					/\/\/\/attributes\:.*?\:\:/g, '');
				const attributes = inlineToken.content.replace(
					/(\/\/\/attributes\:.*?)\:\:.*?$/g, '$1');
				inlineToken.content = content;

				let token = new state.Token('attributes', 'div', 0);									// and create new token
				token.info = attributes;
				addAttributes(token, attributes);
				state.tokens.splice(idx, 0, token);														// insert before td / th
			}
			
			for (const tokens of enumTokenSequence(state, [ 'th_open', 'inline', 'th_close' ]))
			{
				handleTableItem(state, tokens);
			}			
			for (const tokens of enumTokenSequence(state, [ 'td_open', 'inline', 'td_close' ]))
			{
				handleTableItem(state, tokens);
			}			
		}

		/**
		 * @abstract Enumerates all token sequences with a given type sequence. The sequence must
		 * 			 contain an inline token with attributes.
		 * 
		 * @param state 	- the state object
		 * @param sequence 	- token type sequence
		 */		
		function *enumTokenSequence(state: any, sequence: string[])
		{
			const tokens: [] = state.tokens;
			const len = sequence.length;
			const indexInline = sequence.indexOf('inline');
			
			for (let idx = tokens.length - len; idx >= 0; idx --)
			{
				const candidateTokens = tokens.slice(idx, idx + len);
				const inlineToken: any = candidateTokens[indexInline];
				const every = candidateTokens.every(
					(token: any, idx: number) => token.type === sequence[idx]);
				if (every && inlineToken.content.includes(indicator))
				{
					yield { tokens: candidateTokens, index: idx, inlineToken: inlineToken };
				}
			}
		}
		
		let settings = null;

		/**
		 * @abstract Listens for and handles changes of the 'activate_attributes' setting
		 * 			 It seems the event mechanism has no action, only the direct invocation 
		 * 			 does work
		 */		
		function signalListener(blockRuler: any, activate_attributes: Boolean) : void
		{
			if (! activate_attributes)
			{
			  	console.log(`${pluginId} : Disabled attributes`);
				blockRuler.disable(['attributes'], true);
			}
			else
			{
			  	console.log(`${pluginId} : Enabled attributes`);
				blockRuler.enable(['attributes'], true);
			}
		}

		return {
			/**
			 * @abstract The real plugin hooks into markdown-it at 2 places
			 * 			 - tokenizeAttributes
			 * 			 - attributes render (renderIt)
			 *           - fence render (renderItFence)
			 */
			plugin: function(markdownIt: any, ruleOptions: any)
			{
				console.info(`${pluginId} : Here in Plugin (INNER) function : ${ruleOptions.resourceBaseUrl}`);
				
				markdownIt.block.ruler.before('list', 'attributes', tokenizeAttributes, 
					{alt: ['list', 'paragraph', 'reference', 'blockquote', 'fence', 'table']});

				try
				{
					const listener = signalListener.bind(this, markdownIt.block.ruler);
					settings = new Settings(ruleOptions, listener);
					const activateAttributes = settings.activateAttributesSync();
					listener(activateAttributes);
				}
				catch(e)
				{
					console.error(`${e}, settings not working.`);
				}
				
				const attributesRender = markdownIt.renderer.rules.attributes;
				const originalAttributesRender = attributesRender || defaultAttributesRender;

				markdownIt.renderer.rules.attributes = function(...args: [any]) : any 				// replacement for ATTRIBUTES rule (if any)
				{						
					return renderIt(originalAttributesRender, ...args);
				};

				const fenceRender = markdownIt.renderer.rules.fence;
				const originalFenceRender = fenceRender || defaultFenceRender;

				markdownIt.renderer.rules.fence = function(...args: any) : any 						// replacement for FENCE rule
				{						
					return renderItFence(originalFenceRender, ...args);
				};
			},
			
			assets: function() : any {
				return [
					/*{
						inline: true,
						text: '.meta td { background-color: blue; }',
						mime: 'text/css',
					},*/
					{ name: 'markdownIt.css' },
					{ name: 'assets/rating-html.css' },
					{ name: 'assets/rating.css' },
					{ name: 'assets/pre-process.js' },
					{ name: 'assets/rating.js' }
				];
			},
		}
	}
}
