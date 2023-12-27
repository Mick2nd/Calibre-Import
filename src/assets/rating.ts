
function test(msg) {
	alert(msg);
}

function create(parent, tag)
{
	const svgns = 'http://www.w3.org/2000/svg';
	let element = document.createElementNS(svgns, tag);
	if (parent.nodeName === 'DIVX')
	{
		parent.style.backgroundSize = "100px 20px";
		parent.style.backgroundImage = element;
	}
	else
	{
		parent.appendChild(element);
	}
	
	return element;
}

function set(element, map)
{
	if (map == undefined)
	{
		return;
	}
	for (const [ key, val ] of Object.entries(map))
	{
		element.setAttribute(key, val);
	}
}

function create_tree(parent, json)
{
	if (json == undefined)
	{
		return;
	}
	for (const entry of json)
	{
		let element = create(parent, entry.tag);
		set(element, entry.attributes);
		create_tree(element, entry.children);
	}
}

function json_tree(rating)
{
	let json = [{
	
	tag: 'svg',
	attributes: {
			xmlns: 'http://www.w3.org/2000/svg',
			width: '100px',
			viewBox: '0 0 1000 200',
			onclick: 'paint_rating();',
			onclose: 'paint_rating();',
			onload: 'paint_rating();'
	},
	children: [
		{
			tag: 'defs',
			attributes: { },
			children: [
				{
					tag: 'polygon',
					attributes: {
						id: 'raw-star',
						points: '100,10 40,198 190,78 10,78 160,198'
					}
				},
				{
					tag: 'g',
					attributes: {
						id: 'star',
						y: 0
					},
					children: [
						{
							tag: 'use',
							attributes: {
								href: '#raw-star'
							}
						}
					]
				},
				{
					tag: 'g',
					attributes: {
						id: 'raw-stars'
					},
					children: [
						{
							tag: 'use',
							attributes: {
								href: '#star',
								x: 0
							}
						},
						{
							tag: 'use',
							attributes: {
								href: '#star',
								x: 200
							}
						},
						{
							tag: 'use',
							attributes: {
								href: '#star',
								x: 400
							}
						},
						{
							tag: 'use',
							attributes: {
								href: '#star',
								x: 600
							}
						},
						{
							tag: 'use',
							attributes: {
								href: '#star',
								x: 800
							}
						}
					]
				},
				{
					tag: 'clipPath',
					attributes: {
						id: 'clip'
					},
					children: [
						{
							tag: 'rect',
							attributes: {
								id: 'rating',
								x: 0,
								y: 0,
								width: '100%',
								height: '100%',
								transform: `scale(${rating} 1)`
							}
						}
					]
				}				
			]
		},	
		{
			tag: 'rect',
			attributes: {
				id: 'background',
				width: '100%',
				height: '100%'
			},
			children: [
			]
		},
		{
			tag: 'use',
			attributes: {
				id: 'grey-stars',
				href: '#raw-stars',
				x: 0,
				y: 0				
			},
			children: [
			]
		},
		{
			tag: 'use',
			attributes: {
				id: 'stars',
				href: '#raw-stars',
				x: 0,
				y: 0,
				'clip-path': 'url(#clip)'				
			},
			children: [
			]
		},
		{
			tag: 'script',
			attributes: {
				type: 'text/ecmascript',
				href: 'https://dev.w3.org/SVG/modules/ref/master/ref2.js'
			}
		}
	]}];
	
	return json;
}

export default function paint_rating() 
{
	let containers = document.getElementsByClassName("rating");
	let rating = 0;

	for (let container of containers)
	{
		if (container.attributes['rating'] !== undefined)
		{
			rating = container.attributes['rating'].value;
			console.debug(`Rating is: ${rating}`);
		}
		create_tree(container, json_tree(rating));
	}
}

paint_rating();
